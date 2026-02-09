# ============================================================
# STAGE 1: Builder - Install dependencies and compile wheels
# ============================================================
FROM python:3.12-slim AS builder

WORKDIR /build

# Install build dependencies (only needed during build)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies into a virtual environment
# Using venv allows us to copy the entire Python environment to runtime stage
COPY requirements.txt .
RUN python -m venv /opt/venv && \
    /opt/venv/bin/pip install --no-cache-dir --upgrade pip && \
    /opt/venv/bin/pip install --no-cache-dir -r requirements.txt

# ============================================================
# STAGE 2: Runtime - Minimal production image
# ============================================================
FROM python:3.12-slim

WORKDIR /app

# Install only runtime dependencies (libpq5 for PostgreSQL client, curl for healthcheck)
# No build tools, significantly smaller image
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy Python virtual environment from builder
COPY --from=builder /opt/venv /opt/venv

# Set PATH to use virtualenv
ENV PATH="/opt/venv/bin:$PATH"

# Copy application code
COPY . .

# Create non-root user for security
RUN useradd -m -u 1000 appuser && \
    chown -R appuser:appuser /app

USER appuser

# Expose application port
EXPOSE 8000

# Health check for container orchestration (Kubernetes, Docker Compose)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Production command (no --reload for better performance)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
