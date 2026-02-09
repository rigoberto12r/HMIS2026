"""
CQRS (Command Query Responsibility Segregation) pattern implementation.

Separates read and write operations for improved performance and scalability:
- Commands handle writes to the primary database
- Queries handle reads from read replicas
- Projections maintain materialized views for complex reports
"""
