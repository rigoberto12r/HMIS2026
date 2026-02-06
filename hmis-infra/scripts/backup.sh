#!/usr/bin/env bash
# ============================================================================
# HMIS SaaS Platform - Script de Respaldo de Base de Datos
# Genera respaldos de PostgreSQL y los sube a S3 con cifrado y retencion
# ============================================================================

set -euo pipefail
IFS=$'\n\t'

# --- Colores para la salida en consola ---
readonly ROJO='\033[0;31m'
readonly VERDE='\033[0;32m'
readonly AMARILLO='\033[1;33m'
readonly AZUL='\033[0;34m'
readonly SIN_COLOR='\033[0m'

# --- Variables de configuracion ---
readonly DB_HOST="${DB_HOST:-localhost}"
readonly DB_PORT="${DB_PORT:-5432}"
readonly DB_NAME="${DB_NAME:-hmis}"
readonly DB_USER="${DB_USER:-hmis_admin}"
readonly DB_PASSWORD="${DB_PASSWORD:-}"

# Configuracion de S3
readonly S3_BUCKET="${S3_BUCKET:-hmis-production-backups}"
readonly S3_PREFIX="${S3_PREFIX:-database-backups}"
readonly S3_REGION="${S3_REGION:-us-east-1}"
readonly S3_STORAGE_CLASS="${S3_STORAGE_CLASS:-STANDARD_IA}"

# Configuracion del respaldo
readonly BACKUP_DIR="${BACKUP_DIR:-/tmp/hmis-backups}"
readonly BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
readonly COMPRESSION_LEVEL="${COMPRESSION_LEVEL:-9}"
readonly ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:-}"
readonly MAX_PARALLEL_JOBS="${MAX_PARALLEL_JOBS:-4}"

# Marca de tiempo para nombres de archivo
readonly MARCA_TIEMPO=$(date '+%Y%m%d_%H%M%S')
readonly FECHA_HOY=$(date '+%Y-%m-%d')

# Archivo de log
readonly LOG_FILE="${LOG_FILE:-/var/log/hmis/backup.log}"

# --- Funciones auxiliares ---

# Registrar mensajes con marca de tiempo y nivel
log() {
    local nivel="$1"
    shift
    local mensaje="$*"
    local marca_tiempo
    marca_tiempo=$(date '+%Y-%m-%d %H:%M:%S')

    # Escribir al archivo de log
    if [[ -d "$(dirname "${LOG_FILE}")" ]]; then
        echo "[${marca_tiempo}] [${nivel}] ${mensaje}" >> "${LOG_FILE}"
    fi

    # Mostrar en consola con color
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
Uso: $(basename "$0") [OPCIONES]

Genera respaldos de la base de datos PostgreSQL del HMIS y los sube a S3.

Opciones:
  --full              Respaldo completo de toda la base de datos (predeterminado)
  --schema <nombre>   Respaldar solo un esquema especifico (inquilino)
  --all-tenants       Respaldar cada esquema de inquilino por separado
  --globals           Respaldar solo roles y configuracion global
  --no-upload         No subir el respaldo a S3 (solo local)
  --encrypt           Cifrar el respaldo con AES-256 (requiere BACKUP_ENCRYPTION_KEY)
  --verify            Verificar la integridad del respaldo despues de crearlo
  --cleanup           Eliminar respaldos locales antiguos (segun BACKUP_RETENTION_DAYS)
  --notify            Enviar notificacion al finalizar (requiere configuracion de SNS)
  -h, --help          Mostrar esta ayuda

Variables de entorno:
  DB_HOST                  Host de la base de datos [default: localhost]
  DB_PORT                  Puerto de la base de datos [default: 5432]
  DB_NAME                  Nombre de la base de datos [default: hmis]
  DB_USER                  Usuario de la base de datos [default: hmis_admin]
  DB_PASSWORD              Contrasena de la base de datos (requerida)
  S3_BUCKET                Bucket de S3 para respaldos [default: hmis-production-backups]
  S3_PREFIX                Prefijo de la ruta en S3 [default: database-backups]
  S3_REGION                Region de AWS [default: us-east-1]
  BACKUP_DIR               Directorio local temporal [default: /tmp/hmis-backups]
  BACKUP_RETENTION_DAYS    Dias de retencion local [default: 7]
  BACKUP_ENCRYPTION_KEY    Clave para cifrar respaldos con AES-256

Ejemplos:
  $(basename "$0") --full --encrypt --verify
  $(basename "$0") --schema tenant_hospital_central --no-upload
  $(basename "$0") --all-tenants --cleanup --notify
EOF
}

# Verificar que las herramientas necesarias estan disponibles
verificar_dependencias() {
    log INFO "Verificando dependencias del sistema..."

    local dependencias=("pg_dump" "pg_dumpall" "gzip" "aws" "sha256sum")
    local faltantes=()

    for dep in "${dependencias[@]}"; do
        if ! command -v "${dep}" &> /dev/null; then
            faltantes+=("${dep}")
        fi
    done

    if [[ ${#faltantes[@]} -gt 0 ]]; then
        log ERROR "Dependencias faltantes: ${faltantes[*]}"
        exit 1
    fi

    # Verificar openssl si se requiere cifrado
    if [[ "${CIFRAR}" == "true" ]] && ! command -v openssl &> /dev/null; then
        log ERROR "openssl es requerido para cifrar respaldos"
        exit 1
    fi

    log EXITO "Todas las dependencias verificadas"
}

# Verificar la conexion a la base de datos
verificar_conexion_bd() {
    log INFO "Verificando conexion a la base de datos..."

    if ! PGPASSWORD="${DB_PASSWORD}" psql \
        -h "${DB_HOST}" \
        -p "${DB_PORT}" \
        -U "${DB_USER}" \
        -d "${DB_NAME}" \
        -c "SELECT 1;" &> /dev/null; then
        log ERROR "No se pudo conectar a la base de datos ${DB_HOST}:${DB_PORT}/${DB_NAME}"
        exit 1
    fi

    log EXITO "Conexion a la base de datos verificada"
}

# Verificar que hay suficiente espacio en disco
verificar_espacio_disco() {
    log INFO "Verificando espacio disponible en disco..."

    # Obtener tamano aproximado de la base de datos
    local tamano_bd_mb
    tamano_bd_mb=$(PGPASSWORD="${DB_PASSWORD}" psql \
        -h "${DB_HOST}" \
        -p "${DB_PORT}" \
        -U "${DB_USER}" \
        -d "${DB_NAME}" \
        -tAc "SELECT pg_database_size('${DB_NAME}') / 1024 / 1024;" 2>/dev/null || echo "1024")

    # Obtener espacio disponible en el directorio de respaldos (en MB)
    local espacio_disponible_mb
    espacio_disponible_mb=$(df -m "${BACKUP_DIR}" 2>/dev/null | awk 'NR==2 {print $4}' || echo "0")

    # Necesitamos al menos el doble del tamano de la BD (por compresion temporal)
    local espacio_requerido_mb=$((tamano_bd_mb * 2))

    log INFO "Tamano de la base de datos: ~${tamano_bd_mb} MB"
    log INFO "Espacio disponible: ${espacio_disponible_mb} MB"
    log INFO "Espacio requerido estimado: ${espacio_requerido_mb} MB"

    if [[ "${espacio_disponible_mb}" -lt "${espacio_requerido_mb}" ]]; then
        log ERROR "Espacio insuficiente en disco. Disponible: ${espacio_disponible_mb} MB, Requerido: ${espacio_requerido_mb} MB"
        exit 1
    fi

    log EXITO "Espacio en disco verificado"
}

# Realizar respaldo completo de la base de datos
respaldo_completo() {
    local nombre_archivo="hmis_full_${MARCA_TIEMPO}.sql.gz"
    local ruta_archivo="${BACKUP_DIR}/${nombre_archivo}"

    log INFO "=== Iniciando respaldo completo de la base de datos ==="
    log INFO "Archivo de destino: ${ruta_archivo}"

    local inicio
    inicio=$(date +%s)

    # Generar el respaldo con pg_dump en formato personalizado comprimido
    PGPASSWORD="${DB_PASSWORD}" pg_dump \
        -h "${DB_HOST}" \
        -p "${DB_PORT}" \
        -U "${DB_USER}" \
        -d "${DB_NAME}" \
        --verbose \
        --no-owner \
        --no-privileges \
        --serializable-deferrable \
        --format=plain \
        --encoding=UTF8 \
        2>> "${LOG_FILE}" \
        | gzip -"${COMPRESSION_LEVEL}" > "${ruta_archivo}"

    local fin
    fin=$(date +%s)
    local duracion=$((fin - inicio))

    # Obtener tamano del archivo
    local tamano
    tamano=$(du -h "${ruta_archivo}" | cut -f1)

    log EXITO "Respaldo completo generado: ${tamano} en ${duracion} segundos"

    # Cifrar si se solicito
    if [[ "${CIFRAR}" == "true" ]]; then
        cifrar_archivo "${ruta_archivo}"
        nombre_archivo="${nombre_archivo}.enc"
        ruta_archivo="${ruta_archivo}.enc"
    fi

    # Generar checksum para verificacion de integridad
    generar_checksum "${ruta_archivo}"

    # Subir a S3 si no se deshabilito
    if [[ "${SUBIR_S3}" == "true" ]]; then
        subir_a_s3 "${ruta_archivo}" "${S3_PREFIX}/full/${FECHA_HOY}/${nombre_archivo}"
        # Subir tambien el checksum
        subir_a_s3 "${ruta_archivo}.sha256" "${S3_PREFIX}/full/${FECHA_HOY}/${nombre_archivo}.sha256"
    fi

    # Verificar integridad si se solicito
    if [[ "${VERIFICAR}" == "true" ]]; then
        verificar_respaldo "${ruta_archivo}"
    fi
}

# Realizar respaldo de un esquema especifico (un inquilino)
respaldo_esquema() {
    local esquema="$1"
    local nombre_archivo="hmis_schema_${esquema}_${MARCA_TIEMPO}.sql.gz"
    local ruta_archivo="${BACKUP_DIR}/${nombre_archivo}"

    log INFO "Respaldando esquema: ${esquema}"

    local inicio
    inicio=$(date +%s)

    # Respaldar solo el esquema especificado
    PGPASSWORD="${DB_PASSWORD}" pg_dump \
        -h "${DB_HOST}" \
        -p "${DB_PORT}" \
        -U "${DB_USER}" \
        -d "${DB_NAME}" \
        --schema="${esquema}" \
        --no-owner \
        --no-privileges \
        --format=plain \
        --encoding=UTF8 \
        2>> "${LOG_FILE}" \
        | gzip -"${COMPRESSION_LEVEL}" > "${ruta_archivo}"

    local fin
    fin=$(date +%s)
    local duracion=$((fin - inicio))

    local tamano
    tamano=$(du -h "${ruta_archivo}" | cut -f1)

    log EXITO "Esquema '${esquema}' respaldado: ${tamano} en ${duracion} segundos"

    # Cifrar si se solicito
    if [[ "${CIFRAR}" == "true" ]]; then
        cifrar_archivo "${ruta_archivo}"
        nombre_archivo="${nombre_archivo}.enc"
        ruta_archivo="${ruta_archivo}.enc"
    fi

    # Generar checksum
    generar_checksum "${ruta_archivo}"

    # Subir a S3
    if [[ "${SUBIR_S3}" == "true" ]]; then
        subir_a_s3 "${ruta_archivo}" "${S3_PREFIX}/schemas/${esquema}/${FECHA_HOY}/${nombre_archivo}"
        subir_a_s3 "${ruta_archivo}.sha256" "${S3_PREFIX}/schemas/${esquema}/${FECHA_HOY}/${nombre_archivo}.sha256"
    fi
}

# Respaldar todos los esquemas de inquilinos por separado
respaldo_todos_inquilinos() {
    log INFO "=== Respaldando todos los esquemas de inquilinos ==="

    # Obtener lista de esquemas de inquilinos
    local esquemas
    esquemas=$(PGPASSWORD="${DB_PASSWORD}" psql \
        -h "${DB_HOST}" \
        -p "${DB_PORT}" \
        -U "${DB_USER}" \
        -d "${DB_NAME}" \
        -tAc "SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'tenant_%' ORDER BY schema_name;")

    if [[ -z "${esquemas}" ]]; then
        log AVISO "No se encontraron esquemas de inquilinos"
        return
    fi

    local total=0
    local exitosos=0
    local fallidos=0

    while IFS= read -r esquema; do
        if [[ -z "${esquema}" ]]; then
            continue
        fi
        ((total++))

        if respaldo_esquema "${esquema}"; then
            ((exitosos++))
        else
            ((fallidos++))
            log ERROR "Fallo al respaldar esquema: ${esquema}"
        fi
    done <<< "${esquemas}"

    log INFO "Resumen: ${total} esquemas procesados, ${exitosos} exitosos, ${fallidos} fallidos"

    if [[ ${fallidos} -gt 0 ]]; then
        log ERROR "Algunos respaldos de esquemas fallaron"
        return 1
    fi
}

# Respaldar roles globales y configuracion
respaldo_globales() {
    local nombre_archivo="hmis_globals_${MARCA_TIEMPO}.sql.gz"
    local ruta_archivo="${BACKUP_DIR}/${nombre_archivo}"

    log INFO "=== Respaldando roles y configuracion global ==="

    # Respaldar solo roles y tablespaces (no datos)
    PGPASSWORD="${DB_PASSWORD}" pg_dumpall \
        -h "${DB_HOST}" \
        -p "${DB_PORT}" \
        -U "${DB_USER}" \
        --globals-only \
        2>> "${LOG_FILE}" \
        | gzip -"${COMPRESSION_LEVEL}" > "${ruta_archivo}"

    local tamano
    tamano=$(du -h "${ruta_archivo}" | cut -f1)

    log EXITO "Configuracion global respaldada: ${tamano}"

    # Generar checksum
    generar_checksum "${ruta_archivo}"

    # Subir a S3
    if [[ "${SUBIR_S3}" == "true" ]]; then
        subir_a_s3 "${ruta_archivo}" "${S3_PREFIX}/globals/${FECHA_HOY}/${nombre_archivo}"
        subir_a_s3 "${ruta_archivo}.sha256" "${S3_PREFIX}/globals/${FECHA_HOY}/${nombre_archivo}.sha256"
    fi
}

# Cifrar un archivo con AES-256
cifrar_archivo() {
    local archivo="$1"
    local archivo_cifrado="${archivo}.enc"

    if [[ -z "${ENCRYPTION_KEY}" ]]; then
        log ERROR "BACKUP_ENCRYPTION_KEY no esta configurada. No se puede cifrar."
        exit 1
    fi

    log INFO "Cifrando archivo: $(basename "${archivo}")"

    openssl enc -aes-256-cbc -salt -pbkdf2 -iter 100000 \
        -in "${archivo}" \
        -out "${archivo_cifrado}" \
        -pass "pass:${ENCRYPTION_KEY}"

    # Eliminar el archivo sin cifrar
    rm -f "${archivo}"

    local tamano
    tamano=$(du -h "${archivo_cifrado}" | cut -f1)

    log EXITO "Archivo cifrado: ${tamano}"
}

# Generar checksum SHA-256 para verificacion de integridad
generar_checksum() {
    local archivo="$1"

    log INFO "Generando checksum SHA-256..."
    sha256sum "${archivo}" > "${archivo}.sha256"
    log EXITO "Checksum generado: $(cat "${archivo}.sha256")"
}

# Verificar la integridad del respaldo intentando restaurar a /dev/null
verificar_respaldo() {
    local archivo="$1"

    log INFO "Verificando integridad del respaldo..."

    # Si esta cifrado, primero descifrar temporalmente
    local archivo_verificar="${archivo}"
    if [[ "${archivo}" == *.enc ]]; then
        log INFO "Descifrando temporalmente para verificacion..."
        openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 \
            -in "${archivo}" \
            -out "${archivo}.verify.tmp" \
            -pass "pass:${ENCRYPTION_KEY}"
        archivo_verificar="${archivo}.verify.tmp"
    fi

    # Verificar checksum
    if [[ -f "${archivo}.sha256" ]]; then
        if sha256sum --check "${archivo}.sha256" &> /dev/null; then
            log EXITO "Checksum SHA-256 verificado correctamente"
        else
            log ERROR "Verificacion de checksum fallida"
            rm -f "${archivo}.verify.tmp"
            return 1
        fi
    fi

    # Verificar que el archivo gzip es valido
    if [[ "${archivo_verificar}" == *.gz ]]; then
        if gzip -t "${archivo_verificar}" 2>/dev/null; then
            log EXITO "Archivo gzip verificado correctamente"
        else
            log ERROR "Archivo gzip corrupto"
            rm -f "${archivo}.verify.tmp"
            return 1
        fi
    fi

    # Limpiar archivo temporal de verificacion
    rm -f "${archivo}.verify.tmp"

    log EXITO "Verificacion de integridad completada exitosamente"
}

# Subir un archivo a S3
subir_a_s3() {
    local archivo_local="$1"
    local ruta_s3="$2"
    local ruta_completa_s3="s3://${S3_BUCKET}/${ruta_s3}"

    log INFO "Subiendo a S3: ${ruta_completa_s3}"

    local inicio
    inicio=$(date +%s)

    # Subir con cifrado del lado del servidor y clase de almacenamiento configurada
    aws s3 cp "${archivo_local}" "${ruta_completa_s3}" \
        --region "${S3_REGION}" \
        --storage-class "${S3_STORAGE_CLASS}" \
        --sse aws:kms \
        --only-show-errors \
        2>> "${LOG_FILE}"

    local fin
    fin=$(date +%s)
    local duracion=$((fin - inicio))

    # Verificar que el archivo se subio correctamente
    if aws s3 ls "${ruta_completa_s3}" --region "${S3_REGION}" &> /dev/null; then
        log EXITO "Archivo subido exitosamente a S3 en ${duracion} segundos"
    else
        log ERROR "Error al verificar el archivo subido en S3"
        return 1
    fi

    # Agregar etiquetas al objeto en S3
    aws s3api put-object-tagging \
        --bucket "${S3_BUCKET}" \
        --key "${ruta_s3}" \
        --region "${S3_REGION}" \
        --tagging "TagSet=[{Key=Environment,Value=production},{Key=BackupType,Value=database},{Key=CreatedBy,Value=backup-script}]" \
        2>> "${LOG_FILE}" || log AVISO "No se pudieron agregar etiquetas al objeto S3"
}

# Limpiar respaldos locales antiguos
limpiar_respaldos_locales() {
    log INFO "=== Limpiando respaldos locales con mas de ${BACKUP_RETENTION_DAYS} dias ==="

    local archivos_eliminados=0

    while IFS= read -r archivo; do
        if [[ -n "${archivo}" ]]; then
            log INFO "Eliminando: $(basename "${archivo}")"
            rm -f "${archivo}"
            ((archivos_eliminados++))
        fi
    done < <(find "${BACKUP_DIR}" -name "hmis_*.sql.gz*" -mtime +"${BACKUP_RETENTION_DAYS}" -type f 2>/dev/null)

    log EXITO "${archivos_eliminados} archivos antiguos eliminados"
}

# Enviar notificacion via AWS SNS
enviar_notificacion() {
    local estado="$1"
    local mensaje="$2"
    local tema_arn="${SNS_TOPIC_ARN:-}"

    if [[ -z "${tema_arn}" ]]; then
        log AVISO "SNS_TOPIC_ARN no configurado, omitiendo notificacion"
        return
    fi

    local asunto="[HMIS Backup] ${estado} - ${FECHA_HOY}"

    aws sns publish \
        --topic-arn "${tema_arn}" \
        --region "${S3_REGION}" \
        --subject "${asunto}" \
        --message "${mensaje}" \
        2>> "${LOG_FILE}" || log AVISO "No se pudo enviar la notificacion SNS"

    log INFO "Notificacion enviada: ${asunto}"
}

# --- Funcion principal ---

main() {
    # Opciones con valores predeterminados
    local TIPO_RESPALDO="full"
    local ESQUEMA_ESPECIFICO=""
    SUBIR_S3="true"
    CIFRAR="false"
    VERIFICAR="false"
    local LIMPIAR="false"
    local NOTIFICAR="false"

    # Procesar argumentos
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --full)
                TIPO_RESPALDO="full"
                shift
                ;;
            --schema)
                TIPO_RESPALDO="schema"
                ESQUEMA_ESPECIFICO="$2"
                shift 2
                ;;
            --all-tenants)
                TIPO_RESPALDO="all-tenants"
                shift
                ;;
            --globals)
                TIPO_RESPALDO="globals"
                shift
                ;;
            --no-upload)
                SUBIR_S3="false"
                shift
                ;;
            --encrypt)
                CIFRAR="true"
                shift
                ;;
            --verify)
                VERIFICAR="true"
                shift
                ;;
            --cleanup)
                LIMPIAR="true"
                shift
                ;;
            --notify)
                NOTIFICAR="true"
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

    # Validar que la contrasena de la BD esta configurada
    if [[ -z "${DB_PASSWORD}" ]]; then
        log ERROR "La variable de entorno DB_PASSWORD es requerida"
        exit 1
    fi

    # Crear directorios necesarios
    mkdir -p "${BACKUP_DIR}"
    mkdir -p "$(dirname "${LOG_FILE}")" 2>/dev/null || true

    # Mostrar cabecera
    log INFO "============================================================"
    log INFO "Respaldo de Base de Datos HMIS"
    log INFO "============================================================"
    log INFO "Tipo de respaldo:  ${TIPO_RESPALDO}"
    log INFO "Base de datos:     ${DB_HOST}:${DB_PORT}/${DB_NAME}"
    log INFO "Directorio local:  ${BACKUP_DIR}"
    log INFO "Subir a S3:        ${SUBIR_S3}"
    log INFO "Bucket S3:         ${S3_BUCKET}"
    log INFO "Cifrar:            ${CIFRAR}"
    log INFO "Verificar:         ${VERIFICAR}"
    log INFO "Fecha:             ${FECHA_HOY}"
    log INFO "============================================================"

    local inicio_total
    inicio_total=$(date +%s)

    # Verificaciones previas
    verificar_dependencias
    verificar_conexion_bd
    verificar_espacio_disco

    # Ejecutar el tipo de respaldo solicitado
    local exito=true
    case "${TIPO_RESPALDO}" in
        full)
            respaldo_completo || exito=false
            ;;
        schema)
            if [[ -z "${ESQUEMA_ESPECIFICO}" ]]; then
                log ERROR "Debe especificar un nombre de esquema con --schema"
                exit 1
            fi
            respaldo_esquema "${ESQUEMA_ESPECIFICO}" || exito=false
            ;;
        all-tenants)
            respaldo_todos_inquilinos || exito=false
            ;;
        globals)
            respaldo_globales || exito=false
            ;;
    esac

    # Limpiar respaldos antiguos si se solicito
    if [[ "${LIMPIAR}" == "true" ]]; then
        limpiar_respaldos_locales
    fi

    local fin_total
    fin_total=$(date +%s)
    local duracion_total=$((fin_total - inicio_total))

    # Resumen final
    log INFO "============================================================"
    if [[ "${exito}" == "true" ]]; then
        log EXITO "Respaldo completado exitosamente en ${duracion_total} segundos"

        if [[ "${NOTIFICAR}" == "true" ]]; then
            enviar_notificacion "EXITOSO" \
                "Respaldo ${TIPO_RESPALDO} de la base de datos HMIS completado exitosamente.\nDuracion: ${duracion_total} segundos\nFecha: ${FECHA_HOY}"
        fi
    else
        log ERROR "El respaldo finalizo con errores (duracion: ${duracion_total} segundos)"

        if [[ "${NOTIFICAR}" == "true" ]]; then
            enviar_notificacion "FALLIDO" \
                "El respaldo ${TIPO_RESPALDO} de la base de datos HMIS fallo.\nDuracion: ${duracion_total} segundos\nFecha: ${FECHA_HOY}\nRevisar logs en: ${LOG_FILE}"
        fi

        exit 1
    fi
    log INFO "============================================================"
}

# Ejecutar la funcion principal con todos los argumentos
main "$@"
