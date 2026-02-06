# ============================================================================
# HMIS SaaS Platform - Salidas de Terraform
# Valores exportados para uso en scripts, pipelines CI/CD y documentacion
# ============================================================================

# --- Salidas de la VPC ---

output "vpc_id" {
  description = "ID de la VPC creada"
  value       = module.vpc.vpc_id
}

output "private_subnet_ids" {
  description = "IDs de las subredes privadas (usadas por EKS, RDS y Redis)"
  value       = module.vpc.private_subnets
}

output "public_subnet_ids" {
  description = "IDs de las subredes publicas (usadas por el balanceador de carga)"
  value       = module.vpc.public_subnets
}

output "nat_gateway_ips" {
  description = "Direcciones IP elasticas de los NAT Gateways"
  value       = module.vpc.nat_public_ips
}

# --- Salidas del Cluster EKS ---

output "eks_cluster_name" {
  description = "Nombre del cluster EKS"
  value       = module.eks.cluster_name
}

output "eks_cluster_endpoint" {
  description = "Endpoint del API server del cluster EKS"
  value       = module.eks.cluster_endpoint
}

output "eks_cluster_version" {
  description = "Version de Kubernetes desplegada en el cluster"
  value       = module.eks.cluster_version
}

output "eks_cluster_certificate_authority" {
  description = "Certificado CA del cluster codificado en base64 (para configurar kubectl)"
  value       = module.eks.cluster_certificate_authority_data
  sensitive   = true
}

output "eks_cluster_oidc_provider_arn" {
  description = "ARN del proveedor OIDC del cluster (para configurar IRSA)"
  value       = module.eks.oidc_provider_arn
}

output "eks_kubeconfig_command" {
  description = "Comando para configurar kubectl con las credenciales del cluster"
  value       = "aws eks update-kubeconfig --region ${var.aws_region} --name ${module.eks.cluster_name}"
}

# --- Salidas de la Base de Datos RDS ---

output "rds_endpoint" {
  description = "Endpoint de conexion de la instancia RDS PostgreSQL (host:puerto)"
  value       = aws_db_instance.hmis.endpoint
}

output "rds_hostname" {
  description = "Nombre de host de la instancia RDS PostgreSQL"
  value       = aws_db_instance.hmis.address
}

output "rds_port" {
  description = "Puerto de conexion de la base de datos PostgreSQL"
  value       = aws_db_instance.hmis.port
}

output "rds_database_name" {
  description = "Nombre de la base de datos principal"
  value       = aws_db_instance.hmis.db_name
}

output "rds_database_url" {
  description = "URL completa de conexion a la base de datos (sin contrasena por seguridad)"
  value       = "postgresql://${aws_db_instance.hmis.username}:****@${aws_db_instance.hmis.address}:${aws_db_instance.hmis.port}/${aws_db_instance.hmis.db_name}"
  sensitive   = true
}

output "rds_instance_id" {
  description = "Identificador unico de la instancia RDS"
  value       = aws_db_instance.hmis.id
}

# --- Salidas de ElastiCache Redis ---

output "redis_endpoint" {
  description = "Endpoint principal del cluster Redis para conexiones de la aplicacion"
  value       = aws_elasticache_replication_group.hmis.primary_endpoint_address
}

output "redis_reader_endpoint" {
  description = "Endpoint de lectura del cluster Redis (para distribuir carga de lectura)"
  value       = aws_elasticache_replication_group.hmis.reader_endpoint_address
}

output "redis_port" {
  description = "Puerto de conexion del cluster Redis"
  value       = 6379
}

output "redis_connection_url" {
  description = "URL completa de conexion a Redis (sin token por seguridad)"
  value       = "rediss://:****@${aws_elasticache_replication_group.hmis.primary_endpoint_address}:6379"
  sensitive   = true
}

# --- Salidas de S3 ---

output "s3_storage_bucket_name" {
  description = "Nombre del bucket S3 para almacenamiento de archivos"
  value       = aws_s3_bucket.hmis.id
}

output "s3_storage_bucket_arn" {
  description = "ARN del bucket S3 de almacenamiento"
  value       = aws_s3_bucket.hmis.arn
}

output "s3_backups_bucket_name" {
  description = "Nombre del bucket S3 para respaldos de la base de datos"
  value       = aws_s3_bucket.backups.id
}

output "s3_backups_bucket_arn" {
  description = "ARN del bucket S3 de respaldos"
  value       = aws_s3_bucket.backups.arn
}

# --- Salidas de ECR ---

output "ecr_backend_repository_url" {
  description = "URL del repositorio ECR para la imagen Docker del backend"
  value       = aws_ecr_repository.backend.repository_url
}

output "ecr_frontend_repository_url" {
  description = "URL del repositorio ECR para la imagen Docker del frontend"
  value       = aws_ecr_repository.frontend.repository_url
}

# --- Salidas Compuestas (para scripts y automatizacion) ---

output "infrastructure_summary" {
  description = "Resumen completo de la infraestructura desplegada"
  value = {
    entorno             = var.environment
    region              = var.aws_region
    cluster_eks         = module.eks.cluster_name
    endpoint_cluster    = module.eks.cluster_endpoint
    base_datos_endpoint = aws_db_instance.hmis.endpoint
    redis_endpoint      = aws_elasticache_replication_group.hmis.primary_endpoint_address
    bucket_archivos     = aws_s3_bucket.hmis.id
    bucket_respaldos    = aws_s3_bucket.backups.id
    ecr_backend         = aws_ecr_repository.backend.repository_url
    ecr_frontend        = aws_ecr_repository.frontend.repository_url
  }
}
