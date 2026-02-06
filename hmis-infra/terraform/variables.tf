# ============================================================================
# HMIS SaaS Platform - Variables de Terraform
# Definicion de todas las variables configurables de la infraestructura
# ============================================================================

# --- Variables Generales del Proyecto ---

variable "project_name" {
  description = "Nombre del proyecto, usado como prefijo en todos los recursos"
  type        = string
  default     = "hmis"
}

variable "environment" {
  description = "Entorno de despliegue (development, staging, production)"
  type        = string
  default     = "staging"

  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "El entorno debe ser uno de: development, staging, production."
  }
}

variable "aws_region" {
  description = "Region de AWS donde se desplegara la infraestructura"
  type        = string
  default     = "us-east-1"
}

variable "common_tags" {
  description = "Etiquetas comunes aplicadas a todos los recursos"
  type        = map(string)
  default = {
    Application = "HMIS"
    Team        = "Plataforma"
  }
}

# --- Variables de Red (VPC) ---

variable "vpc_cidr" {
  description = "Bloque CIDR principal de la VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "private_subnet_cidrs" {
  description = "Bloques CIDR para las subredes privadas (una por zona de disponibilidad)"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
}

variable "public_subnet_cidrs" {
  description = "Bloques CIDR para las subredes publicas (una por zona de disponibilidad)"
  type        = list(string)
  default     = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]
}

variable "allowed_cidr_blocks" {
  description = "Bloques CIDR autorizados para acceder al endpoint publico del cluster EKS"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

# --- Variables del Cluster EKS ---

variable "eks_cluster_version" {
  description = "Version de Kubernetes para el cluster EKS"
  type        = string
  default     = "1.29"
}

variable "eks_node_instance_types" {
  description = "Tipos de instancia EC2 para los nodos de aplicacion del cluster"
  type        = list(string)
  default     = ["t3.large"]
}

variable "eks_system_node_instance_types" {
  description = "Tipos de instancia EC2 para los nodos del sistema (monitoreo, ingress)"
  type        = list(string)
  default     = ["t3.medium"]
}

variable "eks_node_min_size" {
  description = "Numero minimo de nodos de aplicacion en el grupo de autoescalado"
  type        = number
  default     = 2
}

variable "eks_node_max_size" {
  description = "Numero maximo de nodos de aplicacion en el grupo de autoescalado"
  type        = number
  default     = 10
}

variable "eks_node_desired_size" {
  description = "Numero deseado de nodos de aplicacion en el grupo de autoescalado"
  type        = number
  default     = 3
}

# --- Variables de RDS PostgreSQL ---

variable "rds_instance_class" {
  description = "Clase de instancia para la base de datos RDS PostgreSQL"
  type        = string
  default     = "db.r6g.large"
}

variable "rds_engine_version" {
  description = "Version del motor PostgreSQL"
  type        = string
  default     = "16.2"
}

variable "rds_allocated_storage" {
  description = "Almacenamiento inicial asignado en GB para la base de datos"
  type        = number
  default     = 100
}

variable "rds_max_allocated_storage" {
  description = "Almacenamiento maximo permitido en GB (autoescalado de almacenamiento)"
  type        = number
  default     = 500
}

variable "rds_database_name" {
  description = "Nombre de la base de datos principal"
  type        = string
  default     = "hmis"
}

variable "rds_master_username" {
  description = "Nombre de usuario maestro para la base de datos"
  type        = string
  default     = "hmis_admin"
  sensitive   = true
}

variable "rds_master_password" {
  description = "Contrasena del usuario maestro de la base de datos (usar secretos en produccion)"
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.rds_master_password) >= 16
    error_message = "La contrasena debe tener al menos 16 caracteres por seguridad."
  }
}

variable "rds_max_connections" {
  description = "Numero maximo de conexiones simultaneas permitidas en PostgreSQL"
  type        = string
  default     = "200"
}

# --- Variables de ElastiCache Redis ---

variable "redis_node_type" {
  description = "Tipo de nodo para las instancias de ElastiCache Redis"
  type        = string
  default     = "cache.r6g.large"
}

variable "redis_engine_version" {
  description = "Version del motor Redis"
  type        = string
  default     = "7.1"
}

variable "redis_auth_token" {
  description = "Token de autenticacion para conexiones a Redis (minimo 16 caracteres)"
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.redis_auth_token) >= 16
    error_message = "El token de autenticacion de Redis debe tener al menos 16 caracteres."
  }
}

# --- Variables de S3 ---

variable "cors_allowed_origins" {
  description = "Origenes permitidos para CORS en el bucket S3 (dominios del frontend)"
  type        = list(string)
  default     = ["https://*.hmis.example.com"]
}

# --- Variables de Dominio ---

variable "domain_name" {
  description = "Nombre de dominio principal para la plataforma HMIS"
  type        = string
  default     = "hmis.example.com"
}

variable "acm_certificate_arn" {
  description = "ARN del certificado ACM para TLS/SSL (debe cubrir *.dominio)"
  type        = string
  default     = ""
}
