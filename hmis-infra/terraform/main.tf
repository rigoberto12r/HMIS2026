# ============================================================================
# HMIS SaaS Platform - Configuracion principal de Terraform
# Infraestructura en AWS: VPC, EKS, RDS PostgreSQL, ElastiCache Redis, S3
# ============================================================================

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.25"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.12"
    }
  }

  # Estado remoto en S3 con bloqueo en DynamoDB
  backend "s3" {
    bucket         = "hmis-terraform-state"
    key            = "infrastructure/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "hmis-terraform-locks"
  }
}

# Proveedor de AWS con la region configurada
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "HMIS"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

# Obtener las zonas de disponibilidad activas en la region
data "aws_availability_zones" "available" {
  state = "available"
}

# Obtener el ID de la cuenta actual de AWS
data "aws_caller_identity" "current" {}

# ============================================================================
# VPC - Red Virtual Privada
# Configuracion de red con subredes publicas y privadas en multiples AZs
# ============================================================================

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  name = "${var.project_name}-${var.environment}-vpc"
  cidr = var.vpc_cidr

  # Distribuir subredes en las zonas de disponibilidad
  azs             = slice(data.aws_availability_zones.available.names, 0, 3)
  private_subnets = var.private_subnet_cidrs
  public_subnets  = var.public_subnet_cidrs

  # Habilitar NAT Gateway para que las subredes privadas tengan acceso a internet
  enable_nat_gateway     = true
  single_nat_gateway     = var.environment == "production" ? false : true
  one_nat_gateway_per_az = var.environment == "production" ? true : false

  # Habilitar DNS en la VPC
  enable_dns_hostnames = true
  enable_dns_support   = true

  # Etiquetas requeridas por EKS para descubrimiento automatico de subredes
  public_subnet_tags = {
    "kubernetes.io/role/elb"                                          = 1
    "kubernetes.io/cluster/${var.project_name}-${var.environment}-eks" = "owned"
  }

  private_subnet_tags = {
    "kubernetes.io/role/internal-elb"                                  = 1
    "kubernetes.io/cluster/${var.project_name}-${var.environment}-eks" = "owned"
  }

  tags = var.common_tags
}

# ============================================================================
# EKS - Cluster de Kubernetes Administrado
# Cluster con grupos de nodos gestionados y complementos esenciales
# ============================================================================

module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.0"

  cluster_name    = "${var.project_name}-${var.environment}-eks"
  cluster_version = var.eks_cluster_version

  # Configuracion de red del cluster
  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  # Habilitar acceso publico al endpoint del API server (restringido por CIDR)
  cluster_endpoint_public_access       = true
  cluster_endpoint_public_access_cidrs = var.allowed_cidr_blocks
  cluster_endpoint_private_access      = true

  # Complementos administrados del cluster
  cluster_addons = {
    # Plugin de red para pods
    vpc-cni = {
      most_recent = true
    }
    # Resolucion DNS interna del cluster
    coredns = {
      most_recent = true
    }
    # Proxy de red para servicios de Kubernetes
    kube-proxy = {
      most_recent = true
    }
    # Driver CSI para volumenes EBS
    aws-ebs-csi-driver = {
      most_recent              = true
      service_account_role_arn = module.ebs_csi_irsa.iam_role_arn
    }
  }

  # Grupos de nodos administrados
  eks_managed_node_groups = {
    # Nodos para la aplicacion principal
    aplicacion = {
      name           = "hmis-app-nodes"
      instance_types = var.eks_node_instance_types
      capacity_type  = var.environment == "production" ? "ON_DEMAND" : "SPOT"

      min_size     = var.eks_node_min_size
      max_size     = var.eks_node_max_size
      desired_size = var.eks_node_desired_size

      # Etiquetas para programacion de pods
      labels = {
        role        = "application"
        environment = var.environment
      }

      tags = merge(var.common_tags, {
        NodeGroup = "aplicacion"
      })
    }

    # Nodos dedicados para servicios del sistema (monitoreo, ingress, etc.)
    sistema = {
      name           = "hmis-system-nodes"
      instance_types = var.eks_system_node_instance_types
      capacity_type  = "ON_DEMAND"

      min_size     = 1
      max_size     = 3
      desired_size = 2

      labels = {
        role = "system"
      }

      taints = [{
        key    = "dedicated"
        value  = "system"
        effect = "NO_SCHEDULE"
      }]

      tags = merge(var.common_tags, {
        NodeGroup = "sistema"
      })
    }
  }

  # Habilitar IRSA (IAM Roles for Service Accounts)
  enable_irsa = true

  tags = var.common_tags
}

# Rol IRSA para el driver CSI de EBS
module "ebs_csi_irsa" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version = "~> 5.0"

  role_name             = "${var.project_name}-${var.environment}-ebs-csi"
  attach_ebs_csi_policy = true

  oidc_providers = {
    main = {
      provider_arn               = module.eks.oidc_provider_arn
      namespace_service_accounts = ["kube-system:ebs-csi-controller-sa"]
    }
  }

  tags = var.common_tags
}

# Configurar el proveedor de Kubernetes usando las credenciales del cluster EKS
provider "kubernetes" {
  host                   = module.eks.cluster_endpoint
  cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)

  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "aws"
    args        = ["eks", "get-token", "--cluster-name", module.eks.cluster_name]
  }
}

# ============================================================================
# RDS PostgreSQL - Base de Datos Relacional
# Instancia multi-AZ con respaldos automaticos y cifrado
# ============================================================================

# Grupo de subredes para la base de datos (subredes privadas)
resource "aws_db_subnet_group" "hmis" {
  name       = "${var.project_name}-${var.environment}-db-subnet"
  subnet_ids = module.vpc.private_subnets

  tags = merge(var.common_tags, {
    Name = "${var.project_name}-${var.environment}-db-subnet"
  })
}

# Grupo de seguridad para RDS - solo permite trafico desde el cluster EKS
resource "aws_security_group" "rds" {
  name_prefix = "${var.project_name}-${var.environment}-rds-"
  vpc_id      = module.vpc.vpc_id
  description = "Grupo de seguridad para la base de datos RDS PostgreSQL del HMIS"

  # Permitir trafico PostgreSQL desde las subredes privadas (nodos EKS)
  ingress {
    description = "Acceso PostgreSQL desde subredes privadas"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = var.private_subnet_cidrs
  }

  # Permitir todo el trafico de salida
  egress {
    description = "Trafico de salida sin restricciones"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.common_tags, {
    Name = "${var.project_name}-${var.environment}-rds-sg"
  })

  lifecycle {
    create_before_destroy = true
  }
}

# Grupo de parametros personalizado para PostgreSQL
resource "aws_db_parameter_group" "hmis" {
  family = "postgres16"
  name   = "${var.project_name}-${var.environment}-pg-params"

  # Habilitar busqueda de texto completo con configuracion en espanol
  parameter {
    name  = "default_text_search_config"
    value = "pg_catalog.spanish"
  }

  # Configuracion de registro de consultas lentas
  parameter {
    name  = "log_min_duration_statement"
    value = "1000"
  }

  # Conexiones maximas ajustadas al tamano de instancia
  parameter {
    name  = "max_connections"
    value = var.rds_max_connections
  }

  # Memoria compartida para cache de paginas
  parameter {
    name         = "shared_buffers"
    value        = "{DBInstanceClassMemory/4}"
    apply_method = "pending-reboot"
  }

  tags = var.common_tags
}

# Instancia principal de RDS PostgreSQL
resource "aws_db_instance" "hmis" {
  identifier = "${var.project_name}-${var.environment}-postgres"

  # Motor y version de la base de datos
  engine               = "postgres"
  engine_version       = var.rds_engine_version
  instance_class       = var.rds_instance_class
  allocated_storage    = var.rds_allocated_storage
  max_allocated_storage = var.rds_max_allocated_storage
  storage_type         = "gp3"
  storage_encrypted    = true

  # Credenciales de la base de datos
  db_name  = var.rds_database_name
  username = var.rds_master_username
  password = var.rds_master_password

  # Configuracion de red
  db_subnet_group_name   = aws_db_subnet_group.hmis.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false
  port                   = 5432

  # Grupo de parametros personalizado
  parameter_group_name = aws_db_parameter_group.hmis.name

  # Alta disponibilidad - Multi-AZ en produccion
  multi_az = var.environment == "production" ? true : false

  # Configuracion de respaldos automaticos
  backup_retention_period = var.environment == "production" ? 30 : 7
  backup_window           = "03:00-04:00"
  maintenance_window      = "Mon:04:00-Mon:05:00"

  # Proteccion contra eliminacion accidental
  deletion_protection       = var.environment == "production" ? true : false
  skip_final_snapshot       = var.environment == "production" ? false : true
  final_snapshot_identifier = var.environment == "production" ? "${var.project_name}-${var.environment}-final-snapshot" : null

  # Habilitar Performance Insights para monitoreo de rendimiento
  performance_insights_enabled          = true
  performance_insights_retention_period = var.environment == "production" ? 731 : 7

  # Habilitar actualizaciones menores automaticas
  auto_minor_version_upgrade = true

  # Habilitar registro de auditoria
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  tags = merge(var.common_tags, {
    Name = "${var.project_name}-${var.environment}-postgres"
  })
}

# ============================================================================
# ElastiCache Redis - Cache y Cola de Mensajes
# Cluster con replicacion para sesiones, cache y colas de trabajo
# ============================================================================

# Grupo de subredes para ElastiCache
resource "aws_elasticache_subnet_group" "hmis" {
  name       = "${var.project_name}-${var.environment}-redis-subnet"
  subnet_ids = module.vpc.private_subnets

  tags = var.common_tags
}

# Grupo de seguridad para Redis - acceso solo desde nodos EKS
resource "aws_security_group" "redis" {
  name_prefix = "${var.project_name}-${var.environment}-redis-"
  vpc_id      = module.vpc.vpc_id
  description = "Grupo de seguridad para ElastiCache Redis del HMIS"

  ingress {
    description = "Acceso Redis desde subredes privadas"
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    cidr_blocks = var.private_subnet_cidrs
  }

  egress {
    description = "Trafico de salida sin restricciones"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.common_tags, {
    Name = "${var.project_name}-${var.environment}-redis-sg"
  })

  lifecycle {
    create_before_destroy = true
  }
}

# Grupo de parametros para Redis
resource "aws_elasticache_parameter_group" "hmis" {
  family = "redis7"
  name   = "${var.project_name}-${var.environment}-redis-params"

  # Politica de expulsion: eliminar claves menos usadas recientemente con TTL
  parameter {
    name  = "maxmemory-policy"
    value = "volatile-lru"
  }

  # Habilitar notificaciones de eventos del keyspace
  parameter {
    name  = "notify-keyspace-events"
    value = "Ex"
  }

  tags = var.common_tags
}

# Grupo de replicacion de Redis con modo cluster deshabilitado
resource "aws_elasticache_replication_group" "hmis" {
  replication_group_id = "${var.project_name}-${var.environment}-redis"
  description          = "Cluster Redis para cache y sesiones del HMIS - ${var.environment}"

  # Configuracion del motor
  engine               = "redis"
  engine_version       = var.redis_engine_version
  node_type            = var.redis_node_type
  port                 = 6379
  parameter_group_name = aws_elasticache_parameter_group.hmis.name

  # Configuracion de replicacion
  num_cache_clusters         = var.environment == "production" ? 3 : 1
  automatic_failover_enabled = var.environment == "production" ? true : false
  multi_az_enabled           = var.environment == "production" ? true : false

  # Red y seguridad
  subnet_group_name  = aws_elasticache_subnet_group.hmis.name
  security_group_ids = [aws_security_group.redis.id]

  # Cifrado en transito y en reposo
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = var.redis_auth_token

  # Ventana de mantenimiento
  maintenance_window       = "Tue:04:00-Tue:05:00"
  snapshot_retention_limit = var.environment == "production" ? 7 : 1
  snapshot_window          = "02:00-03:00"

  # Actualizaciones menores automaticas
  auto_minor_version_upgrade = true

  tags = merge(var.common_tags, {
    Name = "${var.project_name}-${var.environment}-redis"
  })
}

# ============================================================================
# S3 - Almacenamiento de Objetos
# Bucket para documentos, imagenes y archivos de los inquilinos
# ============================================================================

# Bucket principal para archivos del HMIS
resource "aws_s3_bucket" "hmis" {
  bucket = "${var.project_name}-${var.environment}-storage-${data.aws_caller_identity.current.account_id}"

  # Proteger contra eliminacion accidental en produccion
  force_destroy = var.environment == "production" ? false : true

  tags = merge(var.common_tags, {
    Name = "${var.project_name}-${var.environment}-storage"
  })
}

# Habilitar versionado para recuperacion de archivos
resource "aws_s3_bucket_versioning" "hmis" {
  bucket = aws_s3_bucket.hmis.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Configuracion de cifrado del lado del servidor con AES-256
resource "aws_s3_bucket_server_side_encryption_configuration" "hmis" {
  bucket = aws_s3_bucket.hmis.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

# Bloquear todo acceso publico al bucket
resource "aws_s3_bucket_public_access_block" "hmis" {
  bucket = aws_s3_bucket.hmis.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Politica de ciclo de vida para gestionar costos de almacenamiento
resource "aws_s3_bucket_lifecycle_configuration" "hmis" {
  bucket = aws_s3_bucket.hmis.id

  # Mover archivos antiguos a almacenamiento mas economico
  rule {
    id     = "transicion-almacenamiento-infrecuente"
    status = "Enabled"

    # Mover a Infrequent Access despues de 90 dias
    transition {
      days          = 90
      storage_class = "STANDARD_IA"
    }

    # Mover a Glacier despues de 365 dias
    transition {
      days          = 365
      storage_class = "GLACIER"
    }
  }

  # Limpiar versiones anteriores de archivos
  rule {
    id     = "limpiar-versiones-anteriores"
    status = "Enabled"

    noncurrent_version_expiration {
      noncurrent_days = 90
    }
  }

  # Limpiar cargas multiparte incompletas
  rule {
    id     = "limpiar-cargas-incompletas"
    status = "Enabled"

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

# Configuracion de CORS para permitir subidas desde el frontend
resource "aws_s3_bucket_cors_configuration" "hmis" {
  bucket = aws_s3_bucket.hmis.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "DELETE", "HEAD"]
    allowed_origins = var.cors_allowed_origins
    expose_headers  = ["ETag", "x-amz-meta-custom-header"]
    max_age_seconds = 3600
  }
}

# Bucket separado para respaldos de la base de datos
resource "aws_s3_bucket" "backups" {
  bucket = "${var.project_name}-${var.environment}-backups-${data.aws_caller_identity.current.account_id}"

  force_destroy = false

  tags = merge(var.common_tags, {
    Name = "${var.project_name}-${var.environment}-backups"
  })
}

# Cifrado para el bucket de respaldos
resource "aws_s3_bucket_server_side_encryption_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

# Bloquear acceso publico al bucket de respaldos
resource "aws_s3_bucket_public_access_block" "backups" {
  bucket = aws_s3_bucket.backups.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Ciclo de vida para respaldos - mover a Glacier despues de 30 dias
resource "aws_s3_bucket_lifecycle_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id

  rule {
    id     = "transicion-respaldos-glacier"
    status = "Enabled"

    transition {
      days          = 30
      storage_class = "GLACIER"
    }

    # Eliminar respaldos despues de 1 ano
    expiration {
      days = 365
    }
  }
}

# ============================================================================
# ECR - Registro de Contenedores
# Repositorios para las imagenes Docker del backend y frontend
# ============================================================================

# Repositorio para la imagen del backend
resource "aws_ecr_repository" "backend" {
  name                 = "${var.project_name}-${var.environment}/backend"
  image_tag_mutability = "IMMUTABLE"

  # Escaneo automatico de vulnerabilidades en las imagenes
  image_scanning_configuration {
    scan_on_push = true
  }

  # Cifrado con clave administrada por AWS
  encryption_configuration {
    encryption_type = "AES256"
  }

  tags = var.common_tags
}

# Repositorio para la imagen del frontend
resource "aws_ecr_repository" "frontend" {
  name                 = "${var.project_name}-${var.environment}/frontend"
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }

  tags = var.common_tags
}

# Politica de ciclo de vida para limpiar imagenes antiguas de ECR
resource "aws_ecr_lifecycle_policy" "backend" {
  repository = aws_ecr_repository.backend.name

  policy = jsonencode({
    rules = [
      {
        # Mantener solo las ultimas 20 imagenes etiquetadas
        rulePriority = 1
        description  = "Mantener las ultimas 20 imagenes etiquetadas"
        selection = {
          tagStatus   = "tagged"
          tagPrefixList = ["v"]
          countType   = "imageCountMoreThan"
          countNumber = 20
        }
        action = {
          type = "expire"
        }
      },
      {
        # Eliminar imagenes sin etiquetar despues de 7 dias
        rulePriority = 2
        description  = "Eliminar imagenes sin etiquetar despues de 7 dias"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 7
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

# Aplicar la misma politica de ciclo de vida al repositorio del frontend
resource "aws_ecr_lifecycle_policy" "frontend" {
  repository = aws_ecr_repository.frontend.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Mantener las ultimas 20 imagenes etiquetadas"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["v"]
          countType     = "imageCountMoreThan"
          countNumber   = 20
        }
        action = {
          type = "expire"
        }
      },
      {
        rulePriority = 2
        description  = "Eliminar imagenes sin etiquetar despues de 7 dias"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 7
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}
