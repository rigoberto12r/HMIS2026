#!/bin/bash
#
# Setup AWS Secrets Manager secrets for HMIS 2026
# Run this script once during initial production deployment
#
# Usage: ./scripts/setup-aws-secrets.sh [--region us-east-1]
#

set -e

# Default AWS region
AWS_REGION="${1:-us-east-1}"

echo "=================================================="
echo "HMIS 2026 - AWS Secrets Manager Setup"
echo "=================================================="
echo ""
echo "Region: $AWS_REGION"
echo ""

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "ERROR: AWS CLI is not installed"
    echo "Install: https://aws.amazon.com/cli/"
    exit 1
fi

# Check if AWS credentials are configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo "ERROR: AWS credentials not configured"
    echo "Run: aws configure"
    exit 1
fi

echo "✓ AWS CLI configured"
echo ""

# Function to create or update secret
create_secret() {
    local secret_name=$1
    local secret_value=$2
    local description=$3

    if aws secretsmanager describe-secret --secret-id "$secret_name" --region "$AWS_REGION" &> /dev/null; then
        echo "Updating existing secret: $secret_name"
        aws secretsmanager put-secret-value \
            --secret-id "$secret_name" \
            --secret-string "$secret_value" \
            --region "$AWS_REGION" \
            --output text > /dev/null
    else
        echo "Creating new secret: $secret_name"
        aws secretsmanager create-secret \
            --name "$secret_name" \
            --description "$description" \
            --secret-string "$secret_value" \
            --region "$AWS_REGION" \
            --output text > /dev/null
    fi
}

# 1. Database credentials
echo "📦 Creating secret: hmis/database"
DATABASE_SECRET=$(cat <<EOF
{
  "DATABASE_URL": "postgresql+asyncpg://hmis_user:CHANGE_THIS_PASSWORD@your-rds-endpoint:5432/hmis"
}
EOF
)
create_secret "hmis/database" "$DATABASE_SECRET" "HMIS Database connection string"

# 2. JWT secrets
echo "📦 Creating secret: hmis/jwt"
JWT_SECRET=$(cat <<EOF
{
  "JWT_SECRET_KEY": "$(openssl rand -base64 64 | tr -d '\n')"
}
EOF
)
create_secret "hmis/jwt" "$JWT_SECRET" "HMIS JWT secret key"

# 3. Redis credentials
echo "📦 Creating secret: hmis/redis"
REDIS_SECRET=$(cat <<EOF
{
  "REDIS_URL": "redis://your-elasticache-endpoint:6379/0"
}
EOF
)
create_secret "hmis/redis" "$REDIS_SECRET" "HMIS Redis connection string"

# 4. Stripe API keys
echo "📦 Creating secret: hmis/stripe"
STRIPE_SECRET=$(cat <<EOF
{
  "STRIPE_SECRET_KEY": "sk_live_REPLACE_WITH_YOUR_STRIPE_SECRET_KEY",
  "STRIPE_PUBLISHABLE_KEY": "pk_live_REPLACE_WITH_YOUR_STRIPE_PUBLISHABLE_KEY",
  "STRIPE_WEBHOOK_SECRET": "whsec_REPLACE_WITH_YOUR_WEBHOOK_SECRET"
}
EOF
)
create_secret "hmis/stripe" "$STRIPE_SECRET" "HMIS Stripe API keys"

# 5. Email service (SendGrid)
echo "📦 Creating secret: hmis/email"
EMAIL_SECRET=$(cat <<EOF
{
  "SENDGRID_API_KEY": "SG.REPLACE_WITH_YOUR_SENDGRID_API_KEY"
}
EOF
)
create_secret "hmis/email" "$EMAIL_SECRET" "HMIS SendGrid API key"

# 6. S3 credentials
echo "📦 Creating secret: hmis/s3"
S3_SECRET=$(cat <<EOF
{
  "S3_ACCESS_KEY": "REPLACE_WITH_YOUR_S3_ACCESS_KEY",
  "S3_SECRET_KEY": "REPLACE_WITH_YOUR_S3_SECRET_KEY"
}
EOF
)
create_secret "hmis/s3" "$S3_SECRET" "HMIS S3 credentials"

echo ""
echo "=================================================="
echo "✅ All secrets created successfully!"
echo "=================================================="
echo ""
echo "⚠️  IMPORTANT: Update placeholder values in AWS Console:"
echo ""
echo "1. Go to AWS Secrets Manager console"
echo "2. Update each secret with production values:"
echo "   - hmis/database → Update RDS endpoint and password"
echo "   - hmis/stripe → Add real Stripe API keys"
echo "   - hmis/email → Add real SendGrid API key"
echo "   - hmis/redis → Update ElastiCache endpoint"
echo "   - hmis/s3 → Add real S3 credentials"
echo ""
echo "3. Enable automatic rotation for sensitive secrets:"
echo "   aws secretsmanager rotate-secret --secret-id hmis/database --rotation-lambda-arn <ARN>"
echo ""
echo "4. Update IAM policy for EC2/ECS to allow secret access:"
echo "   See: scripts/iam-policy-secrets.json"
echo ""
echo "5. Set USE_SECRETS_MANAGER=true in production environment"
echo ""
