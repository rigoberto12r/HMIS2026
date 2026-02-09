# Kubernetes Deployment Guide - HMIS 2026

## Overview

This guide covers deploying HMIS 2026 to Kubernetes with Horizontal Pod Autoscaler (HPA) for automatic scaling based on CPU/memory utilization and custom metrics.

## Prerequisites

### Required Tools

```bash
# kubectl - Kubernetes CLI
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
chmod +x kubectl
sudo mv kubectl /usr/local/bin/

# Verify installation
kubectl version --client

# helm - Kubernetes package manager (optional)
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
```

### Kubernetes Cluster

You'll need a Kubernetes cluster. Options:

**Managed Kubernetes (Recommended for Production):**
- **AWS EKS** - `eksctl create cluster --name hmis-prod --region us-east-1`
- **GCP GKE** - `gcloud container clusters create hmis-prod`
- **Azure AKS** - `az aks create --name hmis-prod`
- **Digital Ocean** - Via web console

**Local Development:**
- **Minikube** - `minikube start --cpus=4 --memory=8192`
- **Kind** - `kind create cluster --name hmis-dev`
- **Docker Desktop** - Enable Kubernetes in settings

### Metrics Server (Required for HPA)

HPA requires metrics-server to read CPU/memory usage:

```bash
# Install metrics-server
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# Verify installation
kubectl get deployment metrics-server -n kube-system
kubectl top nodes
```

---

## Architecture

```
┌─────────────────────────────────────────────┐
│            Ingress (NGINX)                  │
│  - SSL/TLS termination                      │
│  - Routing (frontend/backend)               │
└────────────┬────────────────────────────────┘
             │
       ┌─────┴──────┐
       │            │
┌──────▼──────┐ ┌──▼─────────┐
│  Frontend   │ │  Backend   │
│  Deployment │ │  Deployment│◄────── HPA
│  (2 pods)   │ │  (3-20 pods│        Auto-scales
└─────────────┘ └────┬───────┘
                     │
             ┌───────┴────────┐
             │                │
      ┌──────▼──────┐  ┌─────▼─────┐
      │  PostgreSQL │  │   Redis    │
      │ StatefulSet │  │ Deployment │
      └─────────────┘  └────────────┘
```

---

## Deployment Steps

### 1. Create Namespace

```bash
kubectl apply -f k8s/namespace.yaml

# Verify
kubectl get namespaces
```

### 2. Create Secrets

**IMPORTANT:** Never commit secrets to git!

```bash
# Copy template
cp k8s/secrets.example.yaml k8s/secrets.yaml

# Generate random secrets
SECRET_KEY=$(openssl rand -base64 64 | tr -d '\n')
JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -d '\n')
REDIS_PASSWORD=$(openssl rand -base64 32 | tr -d '\n')

# Base64 encode values
echo -n "postgresql+asyncpg://hmis_admin:${POSTGRES_PASSWORD}@postgres:5432/hmis" | base64
echo -n "redis://:${REDIS_PASSWORD}@redis:6379/0" | base64
echo -n "$SECRET_KEY" | base64
echo -n "$JWT_SECRET" | base64
echo -n "https://hmis-saas.com" | base64

# Edit k8s/secrets.yaml and paste the base64-encoded values
# Then apply
kubectl apply -f k8s/secrets.yaml

# Verify (values will be hidden)
kubectl get secrets -n hmis-prod
```

### 3. Create ConfigMaps

```bash
kubectl apply -f k8s/configmap.yaml

# Verify
kubectl get configmaps -n hmis-prod
```

### 4. Deploy PostgreSQL

```bash
kubectl apply -f k8s/postgres-statefulset.yaml

# Wait for readiness
kubectl wait --for=condition=ready pod -l app=postgres -n hmis-prod --timeout=5m

# Check status
kubectl get statefulsets -n hmis-prod
kubectl get pods -n hmis-prod -l app=postgres

# Check logs
kubectl logs -n hmis-prod -l app=postgres
```

### 5. Deploy Redis

```bash
kubectl apply -f k8s/redis-deployment.yaml

# Wait for readiness
kubectl wait --for=condition=ready pod -l app=redis -n hmis-prod --timeout=3m

# Verify
kubectl get deployments -n hmis-prod
kubectl get pods -n hmis-prod -l app=redis
```

### 6. Deploy Backend

```bash
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/backend-service.yaml

# Watch rollout
kubectl rollout status deployment/hmis-backend -n hmis-prod

# Verify
kubectl get deployments -n hmis-prod
kubectl get pods -n hmis-prod -l app=hmis-backend

# Check logs
kubectl logs -n hmis-prod -l app=hmis-backend --tail=50
```

### 7. Deploy Horizontal Pod Autoscaler

```bash
kubectl apply -f k8s/backend-hpa.yaml

# Verify HPA is working
kubectl get hpa -n hmis-prod

# Expected output:
# NAME               REFERENCE                TARGETS         MINPODS   MAXPODS   REPLICAS
# hmis-backend-hpa   Deployment/hmis-backend  15%/70%, 20%/80%  3         20        3

# Watch HPA in real-time
kubectl get hpa -n hmis-prod -w
```

### 8. Deploy Frontend

```bash
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/frontend-service.yaml

# Wait for readiness
kubectl rollout status deployment/hmis-frontend -n hmis-prod

# Verify
kubectl get deployments -n hmis-prod
kubectl get pods -n hmis-prod -l app=hmis-frontend
```

### 9. Deploy Ingress

**Option A: NGINX Ingress Controller (Recommended)**

```bash
# Install NGINX Ingress Controller
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.9.5/deploy/static/provider/cloud/deploy.yaml

# Wait for external IP
kubectl get svc -n ingress-nginx ingress-nginx-controller -w

# Apply Ingress
kubectl apply -f k8s/ingress.yaml

# Verify
kubectl get ingress -n hmis-prod
kubectl describe ingress hmis-ingress -n hmis-prod
```

**Option B: AWS ALB Ingress Controller (AWS EKS)**

```bash
# Install AWS Load Balancer Controller
eksctl utils associate-iam-oidc-provider --cluster hmis-prod --approve

# Create IAM policy and service account
# See: https://kubernetes-sigs.github.io/aws-load-balancer-controller/

# Apply Ingress with ALB annotations
kubectl apply -f k8s/ingress.yaml
```

### 10. Configure DNS

Point your domain to the Ingress external IP:

```bash
# Get external IP
kubectl get ingress -n hmis-prod hmis-ingress

# Create DNS A records:
# hmis-saas.com → <EXTERNAL_IP>
# www.hmis-saas.com → <EXTERNAL_IP>
# api.hmis-saas.com → <EXTERNAL_IP>
```

### 11. Setup SSL/TLS with cert-manager

```bash
# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.3/cert-manager.yaml

# Create Let's Encrypt ClusterIssuer
cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@hmis-saas.com  # Change this!
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
      - http01:
          ingress:
            class: nginx
EOF

# Certificates will be automatically provisioned via Ingress annotations
# Check certificate status
kubectl get certificate -n hmis-prod
kubectl describe certificate -n hmis-prod hmis-tls-cert
```

---

## Verification

### Check All Resources

```bash
# Get all resources in namespace
kubectl get all -n hmis-prod

# Check pod status
kubectl get pods -n hmis-prod -o wide

# Check services
kubectl get svc -n hmis-prod

# Check ingress
kubectl get ingress -n hmis-prod
```

### Test Health Endpoints

```bash
# Port-forward backend
kubectl port-forward -n hmis-prod svc/hmis-backend 8000:8000

# Test in another terminal
curl http://localhost:8000/health
curl http://localhost:8000/health/ready

# Port-forward frontend
kubectl port-forward -n hmis-prod svc/hmis-frontend 3000:3000

# Test in browser
open http://localhost:3000
```

### Monitor HPA Behavior

```bash
# Watch HPA metrics
kubectl get hpa -n hmis-prod -w

# Generate load to test auto-scaling
kubectl run load-generator \
  --image=busybox \
  --restart=Never \
  --namespace=hmis-prod \
  -- /bin/sh -c "while true; do wget -q -O- http://hmis-backend:8000/health; done"

# Watch pods scale up
kubectl get pods -n hmis-prod -l app=hmis-backend -w

# Stop load generator
kubectl delete pod load-generator -n hmis-prod
```

---

## Scaling Configuration

### Manual Scaling

```bash
# Scale backend manually
kubectl scale deployment hmis-backend -n hmis-prod --replicas=5

# Scale frontend manually
kubectl scale deployment hmis-frontend -n hmis-prod --replicas=4
```

### HPA Configuration

Edit `k8s/backend-hpa.yaml` to adjust scaling parameters:

```yaml
spec:
  minReplicas: 3    # Minimum pods (always running)
  maxReplicas: 20   # Maximum pods (during peak load)

  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          averageUtilization: 70  # Scale when CPU > 70%
```

Apply changes:

```bash
kubectl apply -f k8s/backend-hpa.yaml
```

### Scaling Policies

**Scale Up Policy:**
- Immediate scale-up (stabilizationWindowSeconds: 0)
- Max 100% increase or 4 pods per 15 seconds
- Uses the policy that scales up the most

**Scale Down Policy:**
- Wait 5 minutes before scaling down (stabilizationWindowSeconds: 300)
- Max 50% decrease or 2 pods per 60 seconds
- Uses the policy that scales down the least

This prevents flapping and ensures stable operation.

---

## Monitoring

### Check Resource Usage

```bash
# Overall cluster metrics
kubectl top nodes

# Pod metrics
kubectl top pods -n hmis-prod

# Specific deployment
kubectl top pods -n hmis-prod -l app=hmis-backend
```

### View Logs

```bash
# All backend pods
kubectl logs -n hmis-prod -l app=hmis-backend --tail=100

# Specific pod
kubectl logs -n hmis-prod <pod-name>

# Follow logs
kubectl logs -n hmis-prod -l app=hmis-backend -f

# Previous container logs (after crash)
kubectl logs -n hmis-prod <pod-name> --previous
```

### Describe Resources

```bash
# Deployment details
kubectl describe deployment hmis-backend -n hmis-prod

# Pod details (troubleshooting)
kubectl describe pod <pod-name> -n hmis-prod

# HPA details
kubectl describe hpa hmis-backend-hpa -n hmis-prod

# Events in namespace
kubectl get events -n hmis-prod --sort-by='.lastTimestamp'
```

---

## Updates & Rollbacks

### Rolling Update

```bash
# Update backend image
kubectl set image deployment/hmis-backend \
  backend=ghcr.io/rigoberto12r/hmis-backend:v1.2.0 \
  -n hmis-prod

# Watch rollout
kubectl rollout status deployment/hmis-backend -n hmis-prod

# Check rollout history
kubectl rollout history deployment/hmis-backend -n hmis-prod
```

### Rollback

```bash
# Rollback to previous version
kubectl rollout undo deployment/hmis-backend -n hmis-prod

# Rollback to specific revision
kubectl rollout undo deployment/hmis-backend -n hmis-prod --to-revision=2

# Pause/Resume rollout
kubectl rollout pause deployment/hmis-backend -n hmis-prod
kubectl rollout resume deployment/hmis-backend -n hmis-prod
```

---

## Troubleshooting

### Pod Not Starting

```bash
# Check pod status
kubectl get pods -n hmis-prod

# Describe pod to see events
kubectl describe pod <pod-name> -n hmis-prod

# Check logs
kubectl logs <pod-name> -n hmis-prod

# Check previous container logs
kubectl logs <pod-name> -n hmis-prod --previous

# Execute shell in running container
kubectl exec -it <pod-name> -n hmis-prod -- /bin/sh
```

### HPA Not Scaling

```bash
# Check HPA status
kubectl get hpa -n hmis-prod
kubectl describe hpa hmis-backend-hpa -n hmis-prod

# Verify metrics-server is running
kubectl get deployment metrics-server -n kube-system
kubectl get apiservice v1beta1.metrics.k8s.io -o yaml

# Check resource requests/limits are set
kubectl get deployment hmis-backend -n hmis-prod -o yaml | grep -A 10 resources
```

### Ingress Not Working

```bash
# Check Ingress status
kubectl get ingress -n hmis-prod
kubectl describe ingress hmis-ingress -n hmis-prod

# Check Ingress controller logs
kubectl logs -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx

# Verify DNS
nslookup api.hmis-saas.com

# Test with curl
curl -v https://api.hmis-saas.com/health
```

### Database Connection Issues

```bash
# Check PostgreSQL pod
kubectl get pods -n hmis-prod -l app=postgres
kubectl logs -n hmis-prod -l app=postgres

# Connect to PostgreSQL pod
kubectl exec -it postgres-0 -n hmis-prod -- psql -U hmis_admin -d hmis

# Test connection from backend pod
kubectl exec -it <backend-pod> -n hmis-prod -- curl postgres:5432
```

---

## Cost Optimization

### Resource Recommendations

```bash
# Get resource usage over time
kubectl top pods -n hmis-prod --containers

# Adjust resource requests/limits based on actual usage
# Too high = wasted money
# Too low = poor performance or OOMKilled
```

### Cluster Autoscaler

For cloud providers, enable cluster autoscaler to scale nodes:

**AWS EKS:**
```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/autoscaler/master/cluster-autoscaler/cloudprovider/aws/examples/cluster-autoscaler-autodiscover.yaml
```

**GCP GKE:**
```bash
gcloud container clusters update hmis-prod --enable-autoscaling \
  --min-nodes=3 --max-nodes=10
```

---

## Security Best Practices

1. ✅ **Non-root containers** - All containers run as user 1000
2. ✅ **Secret management** - Kubernetes secrets (consider Sealed Secrets or External Secrets Operator)
3. ✅ **Network policies** - Restrict pod-to-pod communication
4. ✅ **Resource limits** - Prevent resource exhaustion
5. ✅ **TLS/SSL** - All traffic encrypted with cert-manager
6. ✅ **RBAC** - Role-based access control
7. ✅ **Pod Security Standards** - Enforce baseline/restricted policies

---

## Next Steps

1. ✅ **Task #16 Complete** - Kubernetes HPA configured
2. ⏭️ **Task #17** - Disaster Recovery (backup/restore strategies)
3. ⏭️ **Task #18** - i18n + comprehensive testing

---

## References

- Kubernetes Docs: https://kubernetes.io/docs/
- HPA Walkthrough: https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale-walkthrough/
- NGINX Ingress: https://kubernetes.github.io/ingress-nginx/
- cert-manager: https://cert-manager.io/docs/

**Status:** ✅ Implemented in Phase 3 - Task #16
**Commit:** Pending
