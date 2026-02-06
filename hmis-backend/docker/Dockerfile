FROM python:3.12-slim

WORKDIR /app

# Dependencias del sistema operativo necesarias para asyncpg y psycopg
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Instalar dependencias Python primero (capa cacheada si requirements.txt no cambia)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar codigo fuente de la aplicacion
COPY . .

# Puerto de la aplicacion
EXPOSE 8000

# Verificacion de salud del contenedor
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Comando por defecto para produccion (sin --reload)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
