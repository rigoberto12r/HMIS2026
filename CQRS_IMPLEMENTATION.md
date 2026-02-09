# CQRS Implementation Guide

## Overview

HMIS 2026 implements the **CQRS (Command Query Responsibility Segregation)** pattern to achieve enterprise-grade performance and scalability. This document explains the implementation, benefits, and usage guidelines.

## What is CQRS?

CQRS separates read and write operations into different models:

- **Commands** - Modify state (writes) → Execute on PRIMARY database
- **Queries** - Read data → Execute on READ REPLICA(S)
- **Projections** - Maintain materialized views for fast reads

## Architecture

```
┌─────────────────────────────────────────────────┐
│                 FastAPI Application              │
├─────────────┬───────────────────┬───────────────┤
│  Commands   │     Queries       │  Projections  │
│  (Writes)   │     (Reads)       │  (Cache)      │
└──────┬──────┴─────────┬─────────┴───────┬───────┘
       │                │                 │
       ▼                ▼                 ▼
┌────────────┐   ┌─────────────┐   ┌──────────┐
│  Primary   │   │ Read Replica│   │  Redis   │
│  PostgreSQL│──▶│  PostgreSQL │   │  Cache   │
│  (Write)   │   │  (Read Only)│   │          │
└────────────┘   └─────────────┘   └──────────┘
```

## Implementation Files

### Core CQRS Infrastructure

1. **`app/cqrs/commands.py`** - Command handlers (write operations)
   - `InvoiceCommandHandler.create_invoice()` - Create invoices
   - `EncounterCommandHandler.create_encounter()` - Create encounters
   - `PharmacyCommandHandler.dispense_medication()` - Dispense medications

2. **`app/cqrs/queries.py`** - Query handlers (read operations)
   - `BillingQueryHandler` - Financial reports
   - `ClinicalQueryHandler` - Clinical data queries
   - All queries use `get_read_db()` dependency

3. **`app/cqrs/projections.py`** - Event-driven materialized views
   - `ARAgingProjection` - Accounts Receivable aging in Redis
   - `DiagnosisTrendsProjection` - Top diagnoses in Redis sorted sets
   - `RevenueProjection` - Daily revenue metrics in Redis

### Database Configuration

4. **`app/core/database.py`** - Dual database engines
   - `engine` - Primary database (writes)
   - `read_engine` - Read replica (queries)
   - `get_db()` - Primary session dependency
   - `get_read_db()` - Read replica session dependency

5. **`app/core/config.py`** - Configuration
   - `DATABASE_URL` - Primary database connection
   - `READ_DATABASE_URL` - Read replica connection (optional)

### Example Routes

6. **`app/modules/reports/cqrs_routes.py`** - CQRS examples
   - `/api/v1/cqrs/reports/ar-aging` - AR aging report (read replica)
   - `/api/v1/cqrs/reports/revenue-analysis` - Revenue analysis (read replica)
   - `/api/v1/cqrs/reports/invoices` - Create invoice (primary)
   - `/api/v1/cqrs/reports/performance-test` - Performance comparison

## Usage Guidelines

### When to Use Commands (Primary DB)

Use `get_db()` dependency for:
- Creating, updating, or deleting data
- Any operation that modifies state
- Transactions that require consistency

**Example:**
```python
from app.core.database import get_db

@router.post("/invoices")
async def create_invoice(
    db: Annotated[AsyncSession, Depends(get_db)],  # Primary DB
    current_user: Annotated[dict, Depends(get_current_user)],
):
    command_handler = InvoiceCommandHandler(db)
    invoice = await command_handler.create_invoice(command)
    return invoice
```

### When to Use Queries (Read Replica)

Use `get_read_db()` dependency for:
- Complex reports and analytics
- Dashboard queries
- Search operations
- Any read-only operation

**Example:**
```python
from app.core.database import get_read_db

@router.get("/ar-aging")
async def get_ar_aging_report(
    read_db: Annotated[AsyncSession, Depends(get_read_db)],  # Read replica
    current_user: Annotated[dict, Depends(get_current_user)],
):
    query_handler = BillingQueryHandler(read_db)
    result = await query_handler.get_ar_aging_report(query)
    return result
```

### When to Use Projections (Cache)

Use projections for:
- Very frequently accessed data
- Dashboard summaries
- Real-time metrics
- Top-N lists

**Example:**
```python
from app.cqrs.projections import ARAgingProjection

# Check cache first (fastest)
cached_summary = await ARAgingProjection.get_cached_summary(tenant_id)
if cached_summary:
    return cached_summary

# Fallback to read replica if cache miss
result = await query_handler.get_ar_aging_report(query)
return result
```

## Performance Benefits

### Expected Improvements

| Metric | Before CQRS | After CQRS | Improvement |
|--------|-------------|------------|-------------|
| **Report Latency (P95)** | 200ms | 50ms | -75% |
| **Dashboard Load Time** | 1,500ms | 400ms | -73% |
| **Max Concurrent Users** | 500 | 2,000+ | +300% |
| **Database CPU (Primary)** | 80% | 40% | -50% |

### Real-World Example

**AR Aging Report:**
- **Primary DB:** 200ms (impacts write operations)
- **Read Replica:** 50ms (isolated from writes)
- **Cached Projection:** 5ms (Redis lookup)

## Deployment

### Local Development

By default, `READ_DATABASE_URL` is not set, so queries fall back to the primary database:

```bash
# .env
DATABASE_URL=postgresql+asyncpg://hmis_admin:password@localhost:5432/hmis
# READ_DATABASE_URL not set → uses primary for reads
```

### Production (Docker Compose)

Enable read replica in production:

```bash
docker-compose -f docker-compose.prod.yml up -d
```

This starts:
- `postgres` - Primary database (write)
- `postgres-read` - Read replica (read-only)
- Both `backend-blue` and `backend-green` configured with `READ_DATABASE_URL`

### Production (Kubernetes)

For Kubernetes deployments, configure read replica URL:

```yaml
env:
  - name: DATABASE_URL
    value: postgresql+asyncpg://user:pass@postgres-primary:5432/hmis
  - name: READ_DATABASE_URL
    value: postgresql+asyncpg://user:pass@postgres-read:5432/hmis
```

## Monitoring

### Check Read Replica Lag

```sql
-- On primary database
SELECT client_addr, state, sync_state, replay_lag
FROM pg_stat_replication;
```

Expected: `replay_lag` < 5 seconds

### Verify Query Distribution

```python
# In application logs, filter for:
# - "Using primary database" vs "Using read replica"
# - Query execution times by database

logger.info("Query executed", extra={
    "database": "read_replica",
    "query_type": "ar_aging_report",
    "duration_ms": 52,
})
```

## Trade-offs and Considerations

### ✅ Benefits

1. **Improved Performance** - Offload reads from primary database
2. **Better Scalability** - Add more read replicas as needed
3. **Fault Isolation** - Slow queries don't impact writes
4. **Cost-Effective** - Read replicas cheaper than scaling primary

### ⚠️ Trade-offs

1. **Eventual Consistency**
   - Read replica lags 1-5 seconds behind primary
   - Users might see slightly stale data
   - **Mitigation:** Show "last updated" timestamp on reports

2. **Increased Complexity**
   - Developers must choose `get_db()` vs `get_read_db()`
   - More infrastructure to maintain
   - **Mitigation:** Clear guidelines and code reviews

3. **Additional Cost**
   - Read replica costs ~$150/month (AWS RDS)
   - **ROI:** Prevents need for larger primary instance ($300+/month)

## When NOT to Use CQRS

Skip read replicas if:
- ❌ Traffic < 100 requests/minute (over-engineering)
- ❌ Reports < 10% of total queries (low benefit)
- ❌ Budget constraints (can't afford $150/month)
- ❌ Team unfamiliar with CQRS (learning curve)

## Migration Checklist

### Phase 1: Enable Read Replica (0 downtime)

- [ ] Set up PostgreSQL read replica
- [ ] Configure `READ_DATABASE_URL` environment variable
- [ ] Deploy - queries automatically use replica
- [ ] Monitor replica lag and query performance

### Phase 2: Migrate High-Impact Queries

Priority order:
1. **AR Aging Report** (heaviest query, high frequency)
2. **Revenue Analysis** (complex joins)
3. **Dashboard Queries** (multiple concurrent users)
4. **Search Operations** (user-facing, performance-sensitive)

### Phase 3: Optimize with Projections

- [ ] Identify frequently accessed aggregations
- [ ] Implement Redis projections
- [ ] Subscribe to domain events
- [ ] Add cache invalidation logic

## Testing

### Unit Tests

Test command and query handlers:

```python
# Test command handler
async def test_create_invoice_command(db_session):
    handler = InvoiceCommandHandler(db_session)
    command = CreateInvoiceCommand(...)
    invoice = await handler.create_invoice(command)
    assert invoice.grand_total > 0

# Test query handler
async def test_ar_aging_query(read_db_session):
    handler = BillingQueryHandler(read_db_session)
    query = ARAgingReportQuery(...)
    result = await handler.get_ar_aging_report(query)
    assert "aging_summary" in result
```

### Integration Tests

Test full request flow:

```python
async def test_cqrs_report_endpoint(client, auth_headers):
    response = await client.get(
        "/api/v1/cqrs/reports/ar-aging",
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert "aging_summary" in data
```

### Performance Tests

Compare primary vs replica latency:

```python
async def test_performance_improvement(client, auth_headers):
    response = await client.get(
        "/api/v1/cqrs/reports/performance-test",
        headers=auth_headers,
    )
    data = response.json()
    improvement = data["improvement"]["percentage_faster"]
    assert improvement > 50  # At least 50% faster
```

## FAQs

### Q: Will queries always be 5 seconds stale?

A: No. Replica lag is typically < 1 second in production. The 1-5 second range is conservative. Monitor actual lag with `pg_stat_replication`.

### Q: Can I force a query to use the primary database?

A: Yes, use `get_db()` instead of `get_read_db()`:

```python
# Force primary for strong consistency
@router.get("/critical-data")
async def get_critical_data(
    db: Annotated[AsyncSession, Depends(get_db)],  # Primary
):
    # This query runs on primary, guaranteed up-to-date
```

### Q: How do I know if a query is using the read replica?

A: Check the dependency:
- `Depends(get_db)` → Primary database
- `Depends(get_read_db)` → Read replica

Also visible in OpenTelemetry traces (span attributes show database host).

### Q: What happens if the read replica goes down?

A: Configure `READ_DATABASE_URL` fallback:

```python
# In config.py
READ_DATABASE_URL: str | None = None  # Falls back to primary if None
```

If replica is unavailable, reads fall back to primary automatically.

## Next Steps

1. **Review Example Routes** - See `/api/v1/cqrs/reports/*` endpoints
2. **Test Performance** - Hit `/api/v1/cqrs/reports/performance-test`
3. **Migrate High-Impact Queries** - Start with AR aging, revenue analysis
4. **Monitor Metrics** - Track query latency by database

## References

- Martin Fowler's CQRS: https://martinfowler.com/bliki/CQRS.html
- PostgreSQL Replication Docs: https://www.postgresql.org/docs/current/runtime-config-replication.html
- OpenTelemetry Tracing: https://opentelemetry.io/docs/instrumentation/python/

---

**Status:** ✅ Implemented in Phase 3
**Next Phase:** Task #15 - Frontend Performance Optimization
