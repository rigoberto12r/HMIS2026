# HMIS 2026 - Disaster Recovery Playbook

**Version:** 1.0
**Last Updated:** 2026-02-09
**Target RTO:** 15 minutes
**Target RPO:** 5 minutes

---

## Overview

This playbook provides step-by-step procedures for recovering the HMIS 2026 platform from various disaster scenarios. All recovery procedures are designed to meet our target Recovery Time Objective (RTO) of 15 minutes and Recovery Point Objective (RPO) of 5 minutes.

---

## Table of Contents

1. [Backup Strategy](#backup-strategy)
2. [Recovery Scenarios](#recovery-scenarios)
3. [Recovery Procedures](#recovery-procedures)
4. [Verification Steps](#verification-steps)
5. [Contact Information](#contact-information)

---

## Backup Strategy

### Automated Backups

**PostgreSQL:**
- **Frequency:** Daily at 2:00 AM UTC
- **Method:** pg_dump (full logical backup) + WAL archiving
- **Retention:** 30 days
- **Storage:** Local + S3 (us-east-1) + Cross-region replica (us-west-2)
- **RPO:** 5 minutes (via WAL)

**Redis:**
- **Frequency:** Hourly
- **Method:** RDB snapshots + AOF persistence
- **Retention:** 7 days
- **Storage:** Local + S3 (us-east-1)
- **RPO:** 1 hour (snapshots) or real-time (AOF)

**Application Files:**
- **Frequency:** On deployment
- **Method:** Docker images in ECR/Docker Hub
- **Retention:** Last 10 versions

### Backup Locations

```
Primary:   /backups/
           ├── postgres/
           │   ├── hmis_backup_YYYYMMDD_HHMMSS.tar.gz
           │   └── hmis_backup_YYYYMMDD_HHMMSS.tar.gz.sha256
           └── redis/
               ├── redis_backup_YYYYMMDD_HHMMSS.tar.gz
               └── redis_backup_YYYYMMDD_HHMMSS.tar.gz.sha256

S3:        s3://hmis-backups/
           ├── postgres/
           │   └── hmis_backup_*.tar.gz
           ├── redis/
           │   └── redis_backup_*.tar.gz
           └── wal/
               └── [WAL files for PITR]

Replica:   s3://hmis-backups-replica/ (us-west-2)
```

---

## Recovery Scenarios

### Scenario 1: Database Corruption (PostgreSQL)
**Symptoms:** Data integrity errors, corrupted tables, query failures
**Impact:** High (application unusable)
**RTO:** 10 minutes
**Recovery:** [Full Database Restore](#procedure-1-full-database-restore)

### Scenario 2: Accidental Data Deletion
**Symptoms:** Missing records, user reports data loss
**Impact:** Medium (partial data loss)
**RTO:** 15 minutes
**Recovery:** [Point-in-Time Recovery](#procedure-2-point-in-time-recovery-pitr)

### Scenario 3: Cache Failure (Redis)
**Symptoms:** Slow application, cache misses, rate limiting failures
**Impact:** Medium (degraded performance)
**RTO:** 5 minutes
**Recovery:** [Redis Restore](#procedure-3-redis-restore)

### Scenario 4: Complete Infrastructure Loss
**Symptoms:** Regional AWS outage, datacenter failure
**Impact:** Critical (total outage)
**RTO:** 30 minutes
**Recovery:** [Full Infrastructure Recovery](#procedure-4-full-infrastructure-recovery)

### Scenario 5: Kubernetes Cluster Failure
**Symptoms:** All pods down, cluster unreachable
**Impact:** Critical (total outage)
**RTO:** 20 minutes
**Recovery:** [Kubernetes Cluster Recovery](#procedure-5-kubernetes-cluster-recovery)

### Scenario 6: Ransomware Attack
**Symptoms:** Encrypted files, ransom note, unusual file modifications
**Impact:** Critical (potential data loss)
**RTO:** 60 minutes
**Recovery:** [Ransomware Recovery](#procedure-6-ransomware-recovery)

---

## Recovery Procedures

### Procedure 1: Full Database Restore

**Prerequisites:**
- Access to backup server or S3
- PostgreSQL credentials
- Estimated time: 10 minutes

**Steps:**

1. **Identify latest backup**
   ```bash
   # List available backups
   ls -lh /backups/postgres/hmis_backup_*.tar.gz

   # Or from S3
   aws s3 ls s3://hmis-backups/postgres/ | sort -r | head -5
   ```

2. **Stop application connections**
   ```bash
   # Scale down backend pods
   kubectl scale deployment backend --replicas=0 -n hmis

   # Or via docker-compose
   docker-compose stop backend
   ```

3. **Run restore script**
   ```bash
   cd /path/to/hmis/scripts

   # From local backup
   ./restore-db.sh --backup-name hmis_backup_20260209_020000

   # Or from S3
   ./restore-db.sh --backup-name hmis_backup_20260209_020000 --from-s3
   ```

4. **Verify restoration**
   ```bash
   # Connect to database
   psql -h localhost -U postgres -d hmis

   # Check table count
   SELECT COUNT(*) FROM information_schema.tables
   WHERE table_schema = 'public';

   # Check recent records
   SELECT COUNT(*) FROM patients WHERE created_at > NOW() - INTERVAL '1 day';
   ```

5. **Restart application**
   ```bash
   # Scale up backend pods
   kubectl scale deployment backend --replicas=3 -n hmis

   # Or via docker-compose
   docker-compose up -d backend
   ```

6. **Verify application functionality**
   - Access login page: https://hmis.example.com
   - Test patient search
   - Check dashboard loads
   - Verify API health: https://api.hmis.example.com/health

**Expected Duration:** 8-10 minutes

---

### Procedure 2: Point-in-Time Recovery (PITR)

**Use Case:** Recover to specific timestamp before data corruption/deletion

**Prerequisites:**
- WAL archiving enabled
- Target recovery time
- Estimated time: 15 minutes

**Steps:**

1. **Determine recovery target time**
   ```bash
   # Example: Recover to 2:45 PM on Feb 9, 2026
   TARGET_TIME="2026-02-09 14:45:00"
   ```

2. **Stop application**
   ```bash
   kubectl scale deployment backend --replicas=0 -n hmis
   ```

3. **Restore base backup**
   ```bash
   ./restore-db.sh --backup-name hmis_backup_20260209_020000 --from-s3
   ```

4. **Apply WAL files up to target time**
   ```bash
   # Download WAL files from S3
   aws s3 sync s3://hmis-backups/wal/ /var/lib/postgresql/wal_recovery/

   # Create recovery.conf (PostgreSQL 12+)
   cat > /var/lib/postgresql/data/recovery.signal <<EOF
   restore_command = 'cp /var/lib/postgresql/wal_recovery/%f %p'
   recovery_target_time = '${TARGET_TIME}'
   recovery_target_action = 'promote'
   EOF
   ```

5. **Start PostgreSQL and apply WAL**
   ```bash
   # PostgreSQL will automatically apply WAL files
   systemctl restart postgresql

   # Monitor recovery progress
   tail -f /var/log/postgresql/postgresql-*.log
   ```

6. **Verify recovery point**
   ```bash
   psql -U postgres -d hmis -c "SELECT NOW();"
   ```

7. **Restart application**
   ```bash
   kubectl scale deployment backend --replicas=3 -n hmis
   ```

**Expected Duration:** 12-15 minutes

---

### Procedure 3: Redis Restore

**Prerequisites:**
- Access to Redis backup
- Redis credentials
- Estimated time: 5 minutes

**Steps:**

1. **Identify latest backup**
   ```bash
   ls -lh /backups/redis/redis_backup_*.tar.gz | tail -5
   ```

2. **Run restore script**
   ```bash
   cd /path/to/hmis/scripts

   # From local backup
   ./restore-redis.sh --backup-name redis_backup_20260209_120000

   # Or from S3
   ./restore-redis.sh --backup-name redis_backup_20260209_120000 --from-s3
   ```

3. **Verify Redis data**
   ```bash
   redis-cli
   > DBSIZE
   > KEYS ratelimit:*
   > GET some_known_key
   ```

4. **Monitor application**
   - Check rate limiting works
   - Verify cache hits in logs
   - Test authenticated requests

**Expected Duration:** 3-5 minutes

---

### Procedure 4: Full Infrastructure Recovery

**Use Case:** Complete AWS region failure, datacenter loss

**Prerequisites:**
- Secondary region ready (us-west-2)
- DNS provider access
- S3 cross-region replication enabled
- Estimated time: 30 minutes

**Steps:**

1. **Activate secondary region**
   ```bash
   # Set AWS region to secondary
   export AWS_DEFAULT_REGION=us-west-2
   ```

2. **Deploy Kubernetes cluster** (if not pre-provisioned)
   ```bash
   # Using eksctl
   eksctl create cluster --name hmis-dr --region us-west-2 --nodes 3

   # Or Terraform
   cd terraform/
   terraform workspace select dr
   terraform apply -auto-approve
   ```

3. **Deploy application**
   ```bash
   # Apply Kubernetes manifests
   kubectl apply -f k8s/ -n hmis

   # Wait for pods to be ready
   kubectl wait --for=condition=ready pod -l app=backend -n hmis --timeout=5m
   ```

4. **Restore PostgreSQL from S3 replica**
   ```bash
   # Download latest backup from replica bucket
   LATEST_BACKUP=$(aws s3 ls s3://hmis-backups-replica/postgres/ | sort -r | head -1 | awk '{print $4}')

   # Restore database
   kubectl exec -it postgres-0 -n hmis -- bash
   /scripts/restore-db.sh --backup-name ${LATEST_BACKUP%.tar.gz} --from-s3
   ```

5. **Restore Redis**
   ```bash
   kubectl exec -it redis-0 -n hmis -- bash
   /scripts/restore-redis.sh --backup-name redis_backup_latest --from-s3
   ```

6. **Update DNS**
   ```bash
   # Update Route53 or DNS provider to point to new region
   aws route53 change-resource-record-sets \
     --hosted-zone-id Z1234567890ABC \
     --change-batch file://dns-failover.json
   ```

7. **Verify application**
   - Test login: https://hmis.example.com
   - Check database connectivity
   - Verify all services healthy
   - Run smoke tests

8. **Notify stakeholders**
   - Send email to ops team
   - Update status page
   - Notify users of potential data loss window

**Expected Duration:** 25-35 minutes

---

### Procedure 5: Kubernetes Cluster Recovery

**Use Case:** Cluster-level failures, control plane issues

**Prerequisites:**
- Backup of Kubernetes manifests (in Git)
- Access to cloud provider console
- Estimated time: 20 minutes

**Steps:**

1. **Diagnose cluster state**
   ```bash
   # Check node status
   kubectl get nodes

   # Check cluster info
   kubectl cluster-info

   # Check system pods
   kubectl get pods -n kube-system
   ```

2. **If control plane is down:**
   ```bash
   # For managed Kubernetes (EKS/GKE/AKS), open support ticket
   # Most managed services have automatic control plane recovery

   # For self-managed, restore from etcd backup
   etcdctl snapshot restore /backups/etcd/snapshot.db
   ```

3. **If worker nodes are down:**
   ```bash
   # Terminate and replace nodes
   eksctl scale nodegroup --cluster=hmis --name=standard-workers --nodes=3

   # Or via autoscaling
   kubectl scale deployment backend --replicas=6 -n hmis  # Trigger scale-up
   ```

4. **Redeploy application** (if necessary)
   ```bash
   # From Git repository
   git clone https://github.com/org/HMIS2026
   cd HMIS2026
   kubectl apply -f k8s/ -n hmis
   ```

5. **Verify all pods running**
   ```bash
   kubectl get pods -n hmis
   kubectl get svc -n hmis
   kubectl logs -f deployment/backend -n hmis
   ```

**Expected Duration:** 15-25 minutes

---

### Procedure 6: Ransomware Recovery

**Use Case:** Ransomware attack, file encryption, malware

**Prerequisites:**
- Isolated backup system (air-gapped or S3 Object Lock)
- Clean system for restoration
- Estimated time: 60 minutes

**Steps:**

1. **IMMEDIATELY isolate affected systems**
   ```bash
   # Disconnect network
   kubectl cordon node-1 node-2 node-3

   # Stop all pods
   kubectl delete deployment --all -n hmis

   # Block outbound traffic
   iptables -A OUTPUT -j DROP
   ```

2. **Preserve evidence**
   ```bash
   # Take snapshots of infected systems
   aws ec2 create-snapshot --volume-id vol-xxx --description "Ransomware evidence"

   # Save logs
   kubectl logs deployment/backend -n hmis > /evidence/backend-logs.txt
   ```

3. **Notify security team and law enforcement**
   - Contact: security@example.com
   - Document ransom note
   - Do NOT pay ransom

4. **Provision clean infrastructure**
   ```bash
   # Deploy new Kubernetes cluster
   eksctl create cluster --name hmis-clean --region us-east-1 --nodes 3

   # Verify no connections to infected systems
   ```

5. **Restore from verified clean backup**
   ```bash
   # Use backup from BEFORE infection timeframe
   # Typically 3-7 days old to ensure clean state

   CLEAN_DATE="2026-02-02"  # Adjust based on infection timeline
   BACKUP_NAME=$(aws s3 ls s3://hmis-backups/postgres/ | grep $CLEAN_DATE | head -1 | awk '{print $4}')

   ./restore-db.sh --backup-name ${BACKUP_NAME%.tar.gz} --from-s3 --force
   ```

6. **Scan restored systems**
   ```bash
   # Run antivirus/antimalware
   clamscan -r /var/lib/postgresql/data

   # Check for backdoors
   rkhunter --check
   ```

7. **Reset all credentials**
   ```bash
   # Rotate all secrets
   kubectl delete secret --all -n hmis

   # Generate new secrets from AWS Secrets Manager
   ./scripts/setup-aws-secrets.sh --rotate-all

   # Force password reset for all users
   psql -U postgres -d hmis -c "UPDATE users SET force_password_reset = true;"
   ```

8. **Gradual restoration**
   - Restore data incrementally with verification
   - Test each service before restoring next
   - Monitor for suspicious activity

9. **Post-incident review**
   - Document infection vector
   - Update security policies
   - Implement additional monitoring
   - Schedule security audit

**Expected Duration:** 1-4 hours (depending on scope)

---

## Verification Steps

After ANY recovery procedure, perform these verification steps:

### 1. Database Verification
```bash
# Connect to database
psql -U postgres -d hmis

# Check table counts
SELECT
  schemaname,
  COUNT(*) as table_count
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
GROUP BY schemaname;

# Check recent data
SELECT COUNT(*) FROM patients WHERE created_at > NOW() - INTERVAL '24 hours';
SELECT COUNT(*) FROM appointments WHERE appointment_date >= CURRENT_DATE;

# Check referential integrity
SELECT * FROM patients p
LEFT JOIN patient_insurance pi ON p.id = pi.patient_id
WHERE pi.id IS NULL LIMIT 10;
```

### 2. Application Health
```bash
# Health endpoint
curl https://api.hmis.example.com/health
curl https://api.hmis.example.com/health/ready

# Test authentication
curl -X POST https://api.hmis.example.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@hmis.app","password":"test"}'

# Test API endpoints
curl https://api.hmis.example.com/api/v1/patients?page=1 \
  -H "Authorization: Bearer $TOKEN"
```

### 3. Redis Verification
```bash
redis-cli
> DBSIZE
> INFO keyspace
> KEYS ratelimit:*
> GET session:*
```

### 4. Kubernetes Verification
```bash
# Pod status
kubectl get pods -n hmis
kubectl get deployments -n hmis

# Check logs for errors
kubectl logs -l app=backend -n hmis --tail=100

# Check resource usage
kubectl top pods -n hmis
```

### 5. End-to-End Test
- Login to web interface
- Create test patient
- Schedule test appointment
- Generate test invoice
- Verify all data saved

### 6. Monitoring
- Check Prometheus metrics
- Verify alerting works
- Check logs in centralized logging system
- Review OpenTelemetry traces

---

## Rollback Procedures

If recovery fails or causes issues:

### Rollback Database
```bash
# Restore previous backup
./restore-db.sh --backup-name hmis_backup_PREVIOUS_TIMESTAMP --from-s3

# Or use transaction log if available
# (PostgreSQL keeps WAL for rollback within recovery window)
```

### Rollback Application
```bash
# Revert to previous Docker image
kubectl set image deployment/backend backend=hmis-backend:previous-tag -n hmis

# Or rollback deployment
kubectl rollout undo deployment/backend -n hmis
```

---

## Contact Information

### On-Call Rotation
- **Primary:** ops-oncall@example.com (PagerDuty)
- **Backup:** devops-team@example.com

### Escalation Path
1. DevOps Lead: devops-lead@example.com
2. CTO: cto@example.com
3. CEO: ceo@example.com

### External Contacts
- **AWS Support:** Enterprise Support (24/7) - Case Portal
- **Database Consultant:** dba@external-consulting.com
- **Security Incident Response:** security-ir@example.com

---

## Appendix

### Recovery Time Matrix

| Scenario | RTO Target | RTO Actual (tested) | RPO Target | RPO Actual |
|----------|------------|---------------------|------------|------------|
| Database Corruption | 10 min | 8 min | 5 min | 5 min |
| Data Deletion | 15 min | 12 min | 1 hour | Varies |
| Redis Failure | 5 min | 3 min | 1 hour | 1 hour |
| Regional Outage | 30 min | 35 min | 5 min | 10 min |
| Cluster Failure | 20 min | 22 min | 0 min | 0 min |

### Testing Schedule

- **Database Restore:** Monthly (1st Sunday)
- **Redis Restore:** Quarterly
- **Full DR Drill:** Annually
- **PITR Test:** Quarterly

### Compliance Notes

- HIPAA: Backups encrypted at rest and in transit
- SOC 2: Backup verification logs retained for 1 year
- GDPR: Patient data in backups subject to same retention as production

---

## Document Revisions

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-02-09 | DevOps Team | Initial version |

---

**End of Playbook**

For updates or questions, contact: devops@example.com
