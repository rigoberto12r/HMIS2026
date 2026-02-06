-- Inicializacion de la base de datos HMIS
-- Crea extensiones necesarias y schema de ejemplo

-- Extensiones requeridas
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- Para busqueda fuzzy

-- Schema para tenant de prueba
CREATE SCHEMA IF NOT EXISTS tenant_demo;

-- Schema para analytics (datos anonimizados cross-tenant)
CREATE SCHEMA IF NOT EXISTS analytics;

-- Comentario
COMMENT ON DATABASE hmis IS 'HMIS SaaS - Sistema de Gestion Hospitalaria Cloud-Native para Latinoamerica';
