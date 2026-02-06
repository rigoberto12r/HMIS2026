#!/usr/bin/env bash
# ============================================================================
# HMIS SaaS Platform - Script de Aprovisionamiento de Inquilinos
# Crea el esquema PostgreSQL, ejecuta migraciones y siembra datos iniciales
# para un nuevo inquilino en la plataforma multi-tenant
# ============================================================================

set -euo pipefail
IFS=$'\n\t'

# --- Colores para la salida en consola ---
readonly ROJO='\033[0;31m'
readonly VERDE='\033[0;32m'
readonly AMARILLO='\033[1;33m'
readonly AZUL='\033[0;34m'
readonly SIN_COLOR='\033[0m'

# --- Variables de configuracion (pueden ser sobreescritas por variables de entorno) ---
readonly DB_HOST="${DB_HOST:-localhost}"
readonly DB_PORT="${DB_PORT:-5432}"
readonly DB_NAME="${DB_NAME:-hmis}"
readonly DB_USER="${DB_USER:-hmis_admin}"
readonly DB_PASSWORD="${DB_PASSWORD:-}"
readonly MIGRATIONS_DIR="${MIGRATIONS_DIR:-/app/migrations}"
readonly SEED_DIR="${SEED_DIR:-/app/seeds}"
readonly LOG_FILE="${LOG_FILE:-/var/log/hmis/tenant-provision.log}"

# --- Funciones auxiliares ---

# Registrar mensajes con marca de tiempo y nivel
log() {
    local nivel="$1"
    shift
    local mensaje="$*"
    local marca_tiempo
    marca_tiempo=$(date '+%Y-%m-%d %H:%M:%S')

    # Escribir al archivo de log si existe el directorio
    if [[ -d "$(dirname "${LOG_FILE}")" ]]; then
        echo "[${marca_tiempo}] [${nivel}] ${mensaje}" >> "${LOG_FILE}"
    fi

    # Mostrar en consola con color segun el nivel
    case "${nivel}" in
        ERROR)   echo -e "${ROJO}[${marca_tiempo}] [ERROR] ${mensaje}${SIN_COLOR}" >&2 ;;
        EXITO)   echo -e "${VERDE}[${marca_tiempo}] [EXITO] ${mensaje}${SIN_COLOR}" ;;
        AVISO)   echo -e "${AMARILLO}[${marca_tiempo}] [AVISO] ${mensaje}${SIN_COLOR}" ;;
        INFO)    echo -e "${AZUL}[${marca_tiempo}] [INFO]  ${mensaje}${SIN_COLOR}" ;;
        *)       echo "[${marca_tiempo}] [${nivel}] ${mensaje}" ;;
    esac
}

# Mostrar el uso correcto del script
mostrar_uso() {
    cat << EOF
Uso: $(basename "$0") [OPCIONES] --tenant-id <id> --tenant-name <nombre>

Aprovisiona un nuevo inquilino en la plataforma HMIS SaaS.

Opciones requeridas:
  --tenant-id       Identificador unico del inquilino (alfanumerico, guiones permitidos)
  --tenant-name     Nombre legible del inquilino (nombre de la organizacion)

Opciones adicionales:
  --admin-email     Correo electronico del administrador inicial del inquilino
  --admin-name      Nombre del administrador inicial
  --plan            Plan de suscripcion (basico, profesional, empresarial) [default: basico]
  --skip-seed       Omitir la insercion de datos iniciales
  --dry-run         Simular la ejecucion sin realizar cambios
  --force           Forzar el aprovisionamiento incluso si el esquema ya existe
  -h, --help        Mostrar esta ayuda

Variables de entorno:
  DB_HOST           Host de la base de datos [default: localhost]
  DB_PORT           Puerto de la base de datos [default: 5432]
  DB_NAME           Nombre de la base de datos [default: hmis]
  DB_USER           Usuario de la base de datos [default: hmis_admin]
  DB_PASSWORD       Contrasena de la base de datos (requerida)
  MIGRATIONS_DIR    Directorio con archivos de migracion [default: /app/migrations]
  SEED_DIR          Directorio con archivos semilla [default: /app/seeds]

Ejemplos:
  $(basename "$0") --tenant-id hospital-central --tenant-name "Hospital Central" --admin-email admin@hospital.com
  $(basename "$0") --tenant-id clinica-norte --tenant-name "Clinica Norte" --plan profesional --dry-run
EOF
}

# Ejecutar un comando SQL en la base de datos
ejecutar_sql() {
    local sql="$1"
    local descripcion="${2:-Ejecutando SQL}"

    log INFO "${descripcion}"

    if [[ "${SIMULACION}" == "true" ]]; then
        log AVISO "[SIMULACION] Se ejecutaria: ${sql:0:100}..."
        return 0
    fi

    PGPASSWORD="${DB_PASSWORD}" psql \
        -h "${DB_HOST}" \
        -p "${DB_PORT}" \
        -U "${DB_USER}" \
        -d "${DB_NAME}" \
        -v ON_ERROR_STOP=1 \
        -c "${sql}" 2>&1 || {
        log ERROR "Fallo al ejecutar SQL: ${descripcion}"
        return 1
    }
}

# Ejecutar un archivo SQL en la base de datos
ejecutar_archivo_sql() {
    local archivo="$1"
    local descripcion="${2:-Ejecutando archivo SQL}"

    if [[ ! -f "${archivo}" ]]; then
        log AVISO "Archivo no encontrado, omitiendo: ${archivo}"
        return 0
    fi

    log INFO "${descripcion}: ${archivo}"

    if [[ "${SIMULACION}" == "true" ]]; then
        log AVISO "[SIMULACION] Se ejecutaria el archivo: ${archivo}"
        return 0
    fi

    PGPASSWORD="${DB_PASSWORD}" psql \
        -h "${DB_HOST}" \
        -p "${DB_PORT}" \
        -U "${DB_USER}" \
        -d "${DB_NAME}" \
        -v ON_ERROR_STOP=1 \
        -v tenant_schema="${TENANT_SCHEMA}" \
        -v tenant_id="${TENANT_ID}" \
        -v tenant_name="${TENANT_NAME}" \
        -f "${archivo}" 2>&1 || {
        log ERROR "Fallo al ejecutar archivo: ${archivo}"
        return 1
    }
}

# Verificar que las herramientas necesarias estan instaladas
verificar_dependencias() {
    log INFO "Verificando dependencias del sistema..."

    local dependencias=("psql" "openssl" "date")
    local faltantes=()

    for dep in "${dependencias[@]}"; do
        if ! command -v "${dep}" &> /dev/null; then
            faltantes+=("${dep}")
        fi
    done

    if [[ ${#faltantes[@]} -gt 0 ]]; then
        log ERROR "Dependencias faltantes: ${faltantes[*]}"
        log ERROR "Instalar con: apt-get install postgresql-client openssl"
        exit 1
    fi

    log EXITO "Todas las dependencias verificadas correctamente"
}

# Verificar la conexion a la base de datos
verificar_conexion_bd() {
    log INFO "Verificando conexion a la base de datos ${DB_HOST}:${DB_PORT}/${DB_NAME}..."

    if [[ "${SIMULACION}" == "true" ]]; then
        log AVISO "[SIMULACION] Se verificaria la conexion a la base de datos"
        return 0
    fi

    if ! PGPASSWORD="${DB_PASSWORD}" psql \
        -h "${DB_HOST}" \
        -p "${DB_PORT}" \
        -U "${DB_USER}" \
        -d "${DB_NAME}" \
        -c "SELECT 1;" &> /dev/null; then
        log ERROR "No se pudo conectar a la base de datos"
        log ERROR "Verificar: host=${DB_HOST}, puerto=${DB_PORT}, usuario=${DB_USER}, base=${DB_NAME}"
        exit 1
    fi

    log EXITO "Conexion a la base de datos establecida correctamente"
}

# Verificar si el esquema del inquilino ya existe
verificar_esquema_existente() {
    log INFO "Verificando si el esquema '${TENANT_SCHEMA}' ya existe..."

    if [[ "${SIMULACION}" == "true" ]]; then
        return 1
    fi

    local existe
    existe=$(PGPASSWORD="${DB_PASSWORD}" psql \
        -h "${DB_HOST}" \
        -p "${DB_PORT}" \
        -U "${DB_USER}" \
        -d "${DB_NAME}" \
        -tAc "SELECT 1 FROM information_schema.schemata WHERE schema_name = '${TENANT_SCHEMA}';" 2>/dev/null)

    if [[ "${existe}" == "1" ]]; then
        return 0
    fi
    return 1
}

# Crear el esquema de base de datos para el inquilino
crear_esquema() {
    log INFO "=== Creando esquema de base de datos para el inquilino ==="

    # Crear el esquema aislado para el inquilino
    ejecutar_sql \
        "CREATE SCHEMA IF NOT EXISTS \"${TENANT_SCHEMA}\";" \
        "Creando esquema '${TENANT_SCHEMA}'"

    # Crear un rol especifico para el inquilino con permisos limitados
    ejecutar_sql \
        "DO \$\$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${TENANT_SCHEMA}_role') THEN
                CREATE ROLE \"${TENANT_SCHEMA}_role\" NOLOGIN;
            END IF;
        END
        \$\$;" \
        "Creando rol de base de datos para el inquilino"

    # Otorgar permisos sobre el esquema al rol del inquilino
    ejecutar_sql \
        "GRANT USAGE ON SCHEMA \"${TENANT_SCHEMA}\" TO \"${TENANT_SCHEMA}_role\";
         GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA \"${TENANT_SCHEMA}\" TO \"${TENANT_SCHEMA}_role\";
         ALTER DEFAULT PRIVILEGES IN SCHEMA \"${TENANT_SCHEMA}\" GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO \"${TENANT_SCHEMA}_role\";" \
        "Otorgando permisos al rol del inquilino"

    log EXITO "Esquema '${TENANT_SCHEMA}' creado correctamente"
}

# Ejecutar las migraciones de base de datos en el esquema del inquilino
ejecutar_migraciones() {
    log INFO "=== Ejecutando migraciones de base de datos ==="

    # Establecer el search_path al esquema del inquilino
    ejecutar_sql \
        "SET search_path TO \"${TENANT_SCHEMA}\", public;" \
        "Estableciendo search_path al esquema del inquilino"

    # Crear tabla de control de migraciones si no existe
    ejecutar_sql \
        "CREATE TABLE IF NOT EXISTS \"${TENANT_SCHEMA}\".schema_migrations (
            id SERIAL PRIMARY KEY,
            version VARCHAR(255) NOT NULL UNIQUE,
            nombre VARCHAR(255) NOT NULL,
            ejecutada_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            duracion_ms INTEGER
        );" \
        "Creando tabla de control de migraciones"

    # Buscar y ejecutar archivos de migracion en orden
    if [[ ! -d "${MIGRATIONS_DIR}" ]]; then
        log AVISO "Directorio de migraciones no encontrado: ${MIGRATIONS_DIR}"
        log AVISO "Creando tablas base directamente..."
        crear_tablas_base
        return
    fi

    local migraciones_ejecutadas=0
    local migraciones_omitidas=0

    # Iterar sobre archivos de migracion ordenados
    while IFS= read -r archivo_migracion; do
        local nombre_archivo
        nombre_archivo=$(basename "${archivo_migracion}")
        local version
        version=$(echo "${nombre_archivo}" | grep -oP '^\d+' || echo "")

        if [[ -z "${version}" ]]; then
            log AVISO "Omitiendo archivo sin version: ${nombre_archivo}"
            continue
        fi

        # Verificar si la migracion ya fue ejecutada
        if [[ "${SIMULACION}" != "true" ]]; then
            local ya_ejecutada
            ya_ejecutada=$(PGPASSWORD="${DB_PASSWORD}" psql \
                -h "${DB_HOST}" \
                -p "${DB_PORT}" \
                -U "${DB_USER}" \
                -d "${DB_NAME}" \
                -tAc "SELECT 1 FROM \"${TENANT_SCHEMA}\".schema_migrations WHERE version = '${version}';" 2>/dev/null || echo "")

            if [[ "${ya_ejecutada}" == "1" ]]; then
                log INFO "Migracion ${version} ya ejecutada, omitiendo"
                ((migraciones_omitidas++))
                continue
            fi
        fi

        # Ejecutar la migracion
        local inicio
        inicio=$(date +%s%N)

        ejecutar_archivo_sql "${archivo_migracion}" "Ejecutando migracion ${version}"

        local fin
        fin=$(date +%s%N)
        local duracion_ms=$(( (fin - inicio) / 1000000 ))

        # Registrar la migracion ejecutada
        ejecutar_sql \
            "INSERT INTO \"${TENANT_SCHEMA}\".schema_migrations (version, nombre, duracion_ms) VALUES ('${version}', '${nombre_archivo}', ${duracion_ms});" \
            "Registrando migracion ${version}"

        ((migraciones_ejecutadas++))

    done < <(find "${MIGRATIONS_DIR}" -name "*.sql" -type f | sort)

    log EXITO "Migraciones completadas: ${migraciones_ejecutadas} ejecutadas, ${migraciones_omitidas} omitidas"
}

# Crear tablas base cuando no hay archivos de migracion disponibles
crear_tablas_base() {
    log INFO "Creando tablas base del sistema..."

    # Tabla de configuracion del inquilino
    ejecutar_sql \
        "CREATE TABLE IF NOT EXISTS \"${TENANT_SCHEMA}\".tenant_config (
            id SERIAL PRIMARY KEY,
            clave VARCHAR(255) NOT NULL UNIQUE,
            valor TEXT,
            tipo VARCHAR(50) DEFAULT 'string',
            descripcion TEXT,
            creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );" \
        "Creando tabla de configuracion del inquilino"

    # Tabla de usuarios del inquilino
    ejecutar_sql \
        "CREATE TABLE IF NOT EXISTS \"${TENANT_SCHEMA}\".usuarios (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            email VARCHAR(255) NOT NULL UNIQUE,
            nombre VARCHAR(255) NOT NULL,
            apellido VARCHAR(255) NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            rol VARCHAR(50) NOT NULL DEFAULT 'usuario',
            activo BOOLEAN DEFAULT true,
            ultimo_acceso TIMESTAMP WITH TIME ZONE,
            intentos_fallidos INTEGER DEFAULT 0,
            bloqueado_hasta TIMESTAMP WITH TIME ZONE,
            creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );" \
        "Creando tabla de usuarios"

    # Tabla de roles y permisos
    ejecutar_sql \
        "CREATE TABLE IF NOT EXISTS \"${TENANT_SCHEMA}\".roles (
            id SERIAL PRIMARY KEY,
            nombre VARCHAR(100) NOT NULL UNIQUE,
            descripcion TEXT,
            permisos JSONB DEFAULT '[]'::jsonb,
            es_sistema BOOLEAN DEFAULT false,
            creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );" \
        "Creando tabla de roles"

    # Tabla de pacientes
    ejecutar_sql \
        "CREATE TABLE IF NOT EXISTS \"${TENANT_SCHEMA}\".pacientes (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            numero_expediente VARCHAR(50) UNIQUE,
            nombre VARCHAR(255) NOT NULL,
            apellido VARCHAR(255) NOT NULL,
            fecha_nacimiento DATE,
            genero VARCHAR(20),
            tipo_documento VARCHAR(50),
            numero_documento VARCHAR(100),
            telefono VARCHAR(50),
            email VARCHAR(255),
            direccion TEXT,
            ciudad VARCHAR(100),
            estado_civil VARCHAR(50),
            grupo_sanguineo VARCHAR(10),
            alergias TEXT,
            notas TEXT,
            activo BOOLEAN DEFAULT true,
            creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            creado_por UUID REFERENCES \"${TENANT_SCHEMA}\".usuarios(id)
        );" \
        "Creando tabla de pacientes"

    # Tabla de registro de auditoria
    ejecutar_sql \
        "CREATE TABLE IF NOT EXISTS \"${TENANT_SCHEMA}\".auditoria (
            id BIGSERIAL PRIMARY KEY,
            usuario_id UUID,
            accion VARCHAR(50) NOT NULL,
            entidad VARCHAR(100) NOT NULL,
            entidad_id VARCHAR(255),
            datos_anteriores JSONB,
            datos_nuevos JSONB,
            direccion_ip INET,
            agente_usuario TEXT,
            creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );" \
        "Creando tabla de auditoria"

    # Crear indices para optimizar consultas frecuentes
    ejecutar_sql \
        "CREATE INDEX IF NOT EXISTS idx_pacientes_nombre ON \"${TENANT_SCHEMA}\".pacientes (nombre, apellido);
         CREATE INDEX IF NOT EXISTS idx_pacientes_documento ON \"${TENANT_SCHEMA}\".pacientes (tipo_documento, numero_documento);
         CREATE INDEX IF NOT EXISTS idx_pacientes_expediente ON \"${TENANT_SCHEMA}\".pacientes (numero_expediente);
         CREATE INDEX IF NOT EXISTS idx_auditoria_usuario ON \"${TENANT_SCHEMA}\".auditoria (usuario_id, creado_en);
         CREATE INDEX IF NOT EXISTS idx_auditoria_entidad ON \"${TENANT_SCHEMA}\".auditoria (entidad, entidad_id);" \
        "Creando indices de optimizacion"

    log EXITO "Tablas base creadas correctamente"
}

# Sembrar datos iniciales para el nuevo inquilino
sembrar_datos_iniciales() {
    log INFO "=== Sembrando datos iniciales para el inquilino ==="

    # Insertar configuracion predeterminada del inquilino
    ejecutar_sql \
        "INSERT INTO \"${TENANT_SCHEMA}\".tenant_config (clave, valor, tipo, descripcion) VALUES
            ('tenant_id', '${TENANT_ID}', 'string', 'Identificador unico del inquilino'),
            ('tenant_name', '${TENANT_NAME}', 'string', 'Nombre de la organizacion'),
            ('plan', '${PLAN}', 'string', 'Plan de suscripcion activo'),
            ('idioma', 'es', 'string', 'Idioma predeterminado'),
            ('zona_horaria', 'America/Mexico_City', 'string', 'Zona horaria de la organizacion'),
            ('formato_fecha', 'DD/MM/YYYY', 'string', 'Formato de fecha preferido'),
            ('moneda', 'MXN', 'string', 'Moneda predeterminada'),
            ('aprovisionado_en', NOW()::text, 'timestamp', 'Fecha de aprovisionamiento')
        ON CONFLICT (clave) DO NOTHING;" \
        "Insertando configuracion predeterminada del inquilino"

    # Crear roles predeterminados del sistema
    ejecutar_sql \
        "INSERT INTO \"${TENANT_SCHEMA}\".roles (nombre, descripcion, permisos, es_sistema) VALUES
            ('administrador', 'Administrador con acceso completo al sistema',
             '[\"*\"]'::jsonb, true),
            ('medico', 'Medico con acceso a expedientes clinicos',
             '[\"pacientes:leer\", \"pacientes:escribir\", \"consultas:leer\", \"consultas:escribir\", \"recetas:escribir\"]'::jsonb, true),
            ('enfermero', 'Personal de enfermeria con acceso limitado',
             '[\"pacientes:leer\", \"signos_vitales:escribir\", \"notas:escribir\"]'::jsonb, true),
            ('recepcion', 'Personal de recepcion para registro y citas',
             '[\"pacientes:leer\", \"pacientes:escribir\", \"citas:leer\", \"citas:escribir\"]'::jsonb, true),
            ('solo_lectura', 'Acceso de solo lectura para reportes y consultas',
             '[\"pacientes:leer\", \"reportes:leer\"]'::jsonb, true)
        ON CONFLICT (nombre) DO NOTHING;" \
        "Creando roles predeterminados del sistema"

    # Crear el usuario administrador inicial si se proporcionaron datos
    if [[ -n "${ADMIN_EMAIL}" ]]; then
        # Generar una contrasena temporal segura
        local contrasena_temporal
        contrasena_temporal=$(openssl rand -base64 16)

        # Generar hash de la contrasena (bcrypt via PostgreSQL pgcrypto)
        ejecutar_sql \
            "CREATE EXTENSION IF NOT EXISTS pgcrypto;
             INSERT INTO \"${TENANT_SCHEMA}\".usuarios (email, nombre, apellido, password_hash, rol, activo)
             VALUES (
                '${ADMIN_EMAIL}',
                '${ADMIN_NAME:-Administrador}',
                '${TENANT_NAME}',
                crypt('${contrasena_temporal}', gen_salt('bf', 12)),
                'administrador',
                true
             ) ON CONFLICT (email) DO NOTHING;" \
            "Creando usuario administrador inicial"

        log EXITO "Usuario administrador creado: ${ADMIN_EMAIL}"
        log AVISO "Contrasena temporal: ${contrasena_temporal}"
        log AVISO "IMPORTANTE: El administrador debe cambiar esta contrasena en el primer inicio de sesion"
    fi

    # Ejecutar archivos semilla adicionales si existen
    if [[ -d "${SEED_DIR}" ]]; then
        while IFS= read -r archivo_semilla; do
            ejecutar_archivo_sql "${archivo_semilla}" "Ejecutando semilla"
        done < <(find "${SEED_DIR}" -name "*.sql" -type f | sort)
    fi

    log EXITO "Datos iniciales sembrados correctamente"
}

# Registrar el inquilino en la tabla maestra de inquilinos (esquema publico)
registrar_inquilino() {
    log INFO "Registrando inquilino en la tabla maestra..."

    # Crear tabla maestra de inquilinos si no existe (en esquema publico)
    ejecutar_sql \
        "CREATE TABLE IF NOT EXISTS public.tenants (
            id VARCHAR(100) PRIMARY KEY,
            nombre VARCHAR(255) NOT NULL,
            esquema VARCHAR(100) NOT NULL UNIQUE,
            plan VARCHAR(50) DEFAULT 'basico',
            activo BOOLEAN DEFAULT true,
            subdominio VARCHAR(100) UNIQUE,
            admin_email VARCHAR(255),
            creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );" \
        "Verificando tabla maestra de inquilinos"

    # Insertar o actualizar el registro del inquilino
    ejecutar_sql \
        "INSERT INTO public.tenants (id, nombre, esquema, plan, subdominio, admin_email)
         VALUES ('${TENANT_ID}', '${TENANT_NAME}', '${TENANT_SCHEMA}', '${PLAN}', '${TENANT_ID}', '${ADMIN_EMAIL:-}')
         ON CONFLICT (id) DO UPDATE SET
            nombre = EXCLUDED.nombre,
            plan = EXCLUDED.plan,
            actualizado_en = NOW();" \
        "Registrando inquilino en tabla maestra"

    log EXITO "Inquilino registrado en tabla maestra correctamente"
}

# Funcion de limpieza en caso de error durante el aprovisionamiento
limpiar_en_error() {
    log ERROR "=== Error durante el aprovisionamiento - Iniciando limpieza ==="

    if [[ "${SIMULACION}" == "true" ]]; then
        log AVISO "[SIMULACION] Se realizaria limpieza del esquema '${TENANT_SCHEMA}'"
        return
    fi

    # Eliminar el esquema creado si hubo un error
    log AVISO "Eliminando esquema '${TENANT_SCHEMA}' debido al error..."
    PGPASSWORD="${DB_PASSWORD}" psql \
        -h "${DB_HOST}" \
        -p "${DB_PORT}" \
        -U "${DB_USER}" \
        -d "${DB_NAME}" \
        -c "DROP SCHEMA IF EXISTS \"${TENANT_SCHEMA}\" CASCADE;" 2>/dev/null || true

    # Eliminar el registro de la tabla maestra
    PGPASSWORD="${DB_PASSWORD}" psql \
        -h "${DB_HOST}" \
        -p "${DB_PORT}" \
        -U "${DB_USER}" \
        -d "${DB_NAME}" \
        -c "DELETE FROM public.tenants WHERE id = '${TENANT_ID}';" 2>/dev/null || true

    log AVISO "Limpieza completada"
}

# --- Funcion principal ---

main() {
    # Variables con valores predeterminados
    TENANT_ID=""
    TENANT_NAME=""
    ADMIN_EMAIL=""
    ADMIN_NAME=""
    PLAN="basico"
    OMITIR_SEMILLA="false"
    SIMULACION="false"
    FORZAR="false"

    # Procesar argumentos de la linea de comandos
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --tenant-id)
                TENANT_ID="$2"
                shift 2
                ;;
            --tenant-name)
                TENANT_NAME="$2"
                shift 2
                ;;
            --admin-email)
                ADMIN_EMAIL="$2"
                shift 2
                ;;
            --admin-name)
                ADMIN_NAME="$2"
                shift 2
                ;;
            --plan)
                PLAN="$2"
                shift 2
                ;;
            --skip-seed)
                OMITIR_SEMILLA="true"
                shift
                ;;
            --dry-run)
                SIMULACION="true"
                shift
                ;;
            --force)
                FORZAR="true"
                shift
                ;;
            -h|--help)
                mostrar_uso
                exit 0
                ;;
            *)
                log ERROR "Opcion desconocida: $1"
                mostrar_uso
                exit 1
                ;;
        esac
    done

    # Validar parametros requeridos
    if [[ -z "${TENANT_ID}" ]]; then
        log ERROR "El parametro --tenant-id es requerido"
        mostrar_uso
        exit 1
    fi

    if [[ -z "${TENANT_NAME}" ]]; then
        log ERROR "El parametro --tenant-name es requerido"
        mostrar_uso
        exit 1
    fi

    # Validar formato del tenant-id (solo alfanumericos y guiones)
    if ! [[ "${TENANT_ID}" =~ ^[a-z0-9][a-z0-9-]*[a-z0-9]$ ]]; then
        log ERROR "El tenant-id debe contener solo letras minusculas, numeros y guiones"
        log ERROR "No puede comenzar ni terminar con guion. Ejemplo: hospital-central"
        exit 1
    fi

    # Validar que la contrasena de la BD esta configurada
    if [[ -z "${DB_PASSWORD}" ]]; then
        log ERROR "La variable de entorno DB_PASSWORD es requerida"
        exit 1
    fi

    # Validar el plan de suscripcion
    if ! [[ "${PLAN}" =~ ^(basico|profesional|empresarial)$ ]]; then
        log ERROR "Plan invalido: ${PLAN}. Opciones: basico, profesional, empresarial"
        exit 1
    fi

    # Derivar el nombre del esquema del tenant-id
    TENANT_SCHEMA="tenant_${TENANT_ID//-/_}"

    # Crear directorio de logs si no existe
    mkdir -p "$(dirname "${LOG_FILE}")" 2>/dev/null || true

    # Mostrar resumen de la operacion
    log INFO "============================================================"
    log INFO "Aprovisionamiento de Inquilino HMIS"
    log INFO "============================================================"
    log INFO "ID del inquilino:    ${TENANT_ID}"
    log INFO "Nombre:              ${TENANT_NAME}"
    log INFO "Esquema:             ${TENANT_SCHEMA}"
    log INFO "Plan:                ${PLAN}"
    log INFO "Admin email:         ${ADMIN_EMAIL:-no especificado}"
    log INFO "Base de datos:       ${DB_HOST}:${DB_PORT}/${DB_NAME}"
    log INFO "Simulacion:          ${SIMULACION}"
    log INFO "============================================================"

    # Verificar dependencias y conexion
    verificar_dependencias
    verificar_conexion_bd

    # Verificar si el esquema ya existe
    if verificar_esquema_existente; then
        if [[ "${FORZAR}" == "true" ]]; then
            log AVISO "El esquema '${TENANT_SCHEMA}' ya existe. Forzando re-aprovisionamiento..."
            ejecutar_sql \
                "DROP SCHEMA \"${TENANT_SCHEMA}\" CASCADE;" \
                "Eliminando esquema existente"
        else
            log ERROR "El esquema '${TENANT_SCHEMA}' ya existe"
            log ERROR "Usar --force para re-aprovisionar (ELIMINARA todos los datos existentes)"
            exit 1
        fi
    fi

    # Configurar trampa para limpieza en caso de error
    trap limpiar_en_error ERR

    # Ejecutar pasos de aprovisionamiento
    crear_esquema
    ejecutar_migraciones

    if [[ "${OMITIR_SEMILLA}" != "true" ]]; then
        sembrar_datos_iniciales
    else
        log AVISO "Insercion de datos iniciales omitida por solicitud del usuario"
    fi

    # Registrar inquilino en tabla maestra
    registrar_inquilino

    # Desactivar trampa de error
    trap - ERR

    # Resumen final
    log INFO "============================================================"
    log EXITO "Inquilino aprovisionado exitosamente"
    log INFO "============================================================"
    log INFO "Subdominio:          ${TENANT_ID}.hmis.example.com"
    log INFO "Esquema BD:          ${TENANT_SCHEMA}"
    log INFO "Plan:                ${PLAN}"
    if [[ -n "${ADMIN_EMAIL}" ]]; then
        log INFO "Admin:               ${ADMIN_EMAIL}"
    fi
    log INFO "============================================================"
}

# Ejecutar la funcion principal con todos los argumentos
main "$@"
