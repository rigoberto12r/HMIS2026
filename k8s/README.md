# Kubernetes Manifests - HMIS 2026

## Quick Start

### Prerequisites

- Kubernetes cluster (EKS, GKE, AKS, or local with Minikube/Kind)
- kubectl configured
- metrics-server installed (for HPA)

### Deploy All Resources

```bash
# 1. Create secrets first
cp secrets.example.yaml secrets.yaml
# Edit secrets.yaml with actual base64-encoded values
kubectl apply -f secrets.yaml

# 2. Deploy everything else with kustomize
kubectl apply -k .

# 3. Wait for all pods to be ready
kubectl wait --for=condition=ready pod --all -n hmis-prod --timeout=5m

# 4. Get Ingress external IP
kubectl get ingress -n hmis-prod
```

### Verify Deployment

```bash
# Check all resources
kubectl get all -n hmis-prod

# Check HPA status
kubectl get hpa -n hmis-prod

# Test backend health
kubectl port-forward -n hmis-prod svc/hmis-backend 8000:8000
curl http://localhost:8000/health
```

## File Structure

```
k8s/
├── README.md                      # This file
├── kustomization.yaml             # Kustomize configuration
├── namespace.yaml                 # Namespace definition
├── configmap.yaml                 # Application config
├── secrets.example.yaml           # Secret template (DO NOT COMMIT secrets.yaml!)
├── postgres-statefulset.yaml      # PostgreSQL StatefulSet
├── redis-deployment.yaml          # Redis Deployment
├── backend-deployment.yaml        # Backend Deployment
├── backend-service.yaml           # Backend Service
├── backend-hpa.yaml               # Backend HPA (auto-scaling)
├── frontend-deployment.yaml       # Frontend Deployment
├── frontend-service.yaml          # Frontend Service
└── ingress.yaml                   # Ingress (NGINX)
```

## Key Features

### Horizontal Pod Autoscaler (HPA)

- **Min Replicas:** 3 (always running)
- **Max Replicas:** 20 (during peak load)
- **Scale Up:** Immediate (when CPU > 70% or Memory > 80%)
- **Scale Down:** Wait 5 minutes, gradual (prevent flapping)

### Zero-Downtime Deployments

- **Strategy:** RollingUpdate
- **maxSurge:** 1 pod
- **maxUnavailable:** 0 pods (always available)

### Health Checks

- **Liveness:** `/health/live` - Is container alive?
- **Readiness:** `/health/ready` - Is container ready for traffic?
- **Startup:** `/health/live` - Initial startup (60s timeout)

### Resource Management

**Backend Pod:**
- Requests: 200m CPU, 512Mi memory
- Limits: 1000m CPU, 1Gi memory

**Frontend Pod:**
- Requests: 100m CPU, 256Mi memory
- Limits: 500m CPU, 512Mi memory

**PostgreSQL:**
- Requests: 500m CPU, 1Gi memory
- Limits: 2000m CPU, 4Gi memory
- Storage: 100Gi

## Common Commands

### Scaling

```bash
# Scale backend manually
kubectl scale deployment hmis-backend -n hmis-prod --replicas=5

# Check HPA status
kubectl get hpa -n hmis-prod -w
```

### Updates

```bash
# Update backend image
kubectl set image deployment/hmis-backend \
  backend=ghcr.io/rigoberto12r/hmis-backend:v1.2.0 \
  -n hmis-prod

# Rollback if needed
kubectl rollout undo deployment/hmis-backend -n hmis-prod
```

### Logs

```bash
# Backend logs
kubectl logs -n hmis-prod -l app=hmis-backend --tail=100 -f

# PostgreSQL logs
kubectl logs -n hmis-prod -l app=postgres --tail=50
```

### Troubleshooting

```bash
# Describe pod to see events
kubectl describe pod <pod-name> -n hmis-prod

# Execute shell in container
kubectl exec -it <pod-name> -n hmis-prod -- /bin/sh

# Port-forward for local testing
kubectl port-forward -n hmis-prod svc/hmis-backend 8000:8000
```

## Security Notes

⚠️ **IMPORTANT:**
1. Never commit `secrets.yaml` to git
2. Rotate secrets regularly
3. Use RBAC to restrict access
4. Enable Pod Security Standards
5. Consider using External Secrets Operator for production

## Cost Estimates

**Monthly costs (AWS EKS example):**
- 3 t3.large nodes (baseline): ~$150/month
- EKS cluster: $73/month
- Load Balancer: ~$20/month
- Storage (100Gi RDS + 10Gi Redis): ~$15/month
- **Total:** ~$258/month baseline

With auto-scaling to 20 pods during peak:
- Additional 2-3 nodes: +$100-150/month (only during peak hours)

## Next Steps

1. Configure DNS (point domain to Ingress IP)
2. Setup cert-manager for SSL/TLS
3. Configure Prometheus for custom metrics
4. Setup backup/restore for PostgreSQL (Task #17)
5. Configure monitoring and alerting

## Documentation

See `KUBERNETES_DEPLOYMENT.md` in project root for comprehensive deployment guide.
