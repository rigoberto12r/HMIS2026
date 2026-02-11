# Custom Reporting System

A comprehensive reporting system for the HMIS application that enables users to generate, schedule, and export custom reports across clinical, financial, and operational data.

## Features

### 1. Predefined Report Templates

Six built-in report templates organized by category:

#### Clinical Reports
- **Patient Demographics**: Patient statistics by age group, gender, and insurance coverage
- **Diagnosis Trends**: Top diagnoses over time with frequency analysis
- **Provider Productivity**: Provider statistics including appointments and completion rates

#### Financial Reports
- **Revenue Analysis**: Revenue breakdown by service, payment method, and time period
- **Insurance Claims**: Claims by status, insurer, and approval rates

#### Operational Reports
- **Appointment Statistics**: Appointment breakdown by status, type, and specialty

### 2. Custom Report Builder

Create custom reports with:
- **Data Source Selection**: Choose from Patients, Appointments, Billing, Pharmacy, or EMR
- **Field Selection**: Pick specific fields to include in the report
- **Filters**: Apply multiple filters with operators (equals, contains, greater than, etc.)
- **Grouping**: Group results by one or more fields
- **Sorting**: Sort by multiple fields in ascending or descending order
- **Limits**: Control the number of results returned

### 3. Multiple Export Formats

Export reports in various formats:
- **JSON**: View directly in browser with interactive table
- **CSV**: Download for Excel/spreadsheet analysis
- **Excel**: Download with formatted headers and styling
- **PDF**: Download print-ready formatted report

### 4. Scheduled Reports

Schedule reports to run automatically:
- **Daily**: Run every day at a specific time
- **Weekly**: Run on a specific day of the week
- **Monthly**: Run on a specific day of the month
- **Email Delivery**: Automatically email results to multiple recipients
- **Enable/Disable**: Turn schedules on/off without deleting them

### 5. Execution History

Track all report executions with:
- Execution timestamp
- Row count
- Execution time (milliseconds)
- Status (completed, failed, pending)
- Error messages (if failed)
- Download links for exported files

## API Endpoints

### Report Definitions

```
POST   /api/v1/reports/definitions         - Create report definition
GET    /api/v1/reports/definitions         - List report definitions
GET    /api/v1/reports/definitions/{id}    - Get report definition
PUT    /api/v1/reports/definitions/{id}    - Update report definition
DELETE /api/v1/reports/definitions/{id}    - Delete report definition
```

### Report Execution

```
POST   /api/v1/reports/execute                      - Execute report
GET    /api/v1/reports/executions/{id}              - Get execution results
GET    /api/v1/reports/executions/{id}/download     - Download report file
```

### Predefined Templates

```
GET    /api/v1/reports/templates                    - List available templates
POST   /api/v1/reports/templates/execute            - Execute template
```

### Scheduled Reports

```
POST   /api/v1/reports/schedule         - Create scheduled report
GET    /api/v1/reports/scheduled        - List scheduled reports
PUT    /api/v1/reports/scheduled/{id}   - Update scheduled report
DELETE /api/v1/reports/scheduled/{id}   - Delete scheduled report
```

## Database Models

### ReportDefinition
Stores custom report configurations with query definitions, filters, and metadata.

### ScheduledReport
Stores recurring report schedules with frequency, recipients, and execution tracking.

### ReportExecution
Stores individual report execution records with performance metrics and file paths.

## Usage Examples

### 1. Execute a Predefined Report

```python
POST /api/v1/reports/templates/execute
{
  "template_name": "patient_demographics",
  "parameters": {
    "start_date": "2026-01-01",
    "end_date": "2026-01-31"
  },
  "export_format": "excel"
}
```

### 2. Create a Custom Report

```python
POST /api/v1/reports/definitions
{
  "name": "Active Patients by Gender",
  "description": "List of all active patients grouped by gender",
  "report_type": "clinical",
  "query_config": {
    "data_source": "patients",
    "fields": ["first_name", "last_name", "gender", "phone", "email"],
    "filters": [
      {
        "field": "status",
        "operator": "equals",
        "value": "active"
      }
    ],
    "group_by": ["gender"],
    "sort": [
      {
        "field": "last_name",
        "direction": "asc"
      }
    ],
    "limit": 1000
  }
}
```

### 3. Schedule a Report

```python
POST /api/v1/reports/schedule
{
  "report_definition_id": "uuid-of-report",
  "schedule_type": "weekly",
  "schedule_config": {
    "day_of_week": 1,  // Tuesday
    "hour": 9,
    "minute": 0
  },
  "recipients": [
    "director@hospital.com",
    "finance@hospital.com"
  ]
}
```

## Frontend Components

### ReportTemplates
Displays predefined report templates organized by category with parameter forms and execution.

### ReportBuilder
Interactive report builder for creating custom reports with drag-drop field selection, filter builder, and preview.

### ReportViewer
Modal component for viewing report results with column visibility toggles, search, and export options.

### ScheduledReports
Manage scheduled reports with enable/disable toggles, edit forms, and execution history.

## Permissions

The reporting system uses the following permissions:
- `reports:read` - View reports and executions
- `reports:create` - Create and edit report definitions
- `reports:execute` - Run reports and generate exports

## Performance Considerations

1. **Caching**: Small result sets (≤1000 rows) are cached in the execution record
2. **Pagination**: Frontend implements pagination for large result sets
3. **Limits**: Reports have configurable row limits to prevent performance issues
4. **Indexes**: Database indexes on tenant_id, execution dates, and status fields
5. **Background Jobs**: Scheduled reports run as background tasks

## Security

1. **Tenant Isolation**: All queries automatically filtered by tenant_id
2. **Permission Checks**: All endpoints require appropriate permissions
3. **Input Validation**: Pydantic schemas validate all input data
4. **File Access**: Downloaded files verified to belong to requesting tenant
5. **SQL Injection**: SQLAlchemy ORM prevents SQL injection attacks

## Future Enhancements

Potential improvements for future versions:

1. **Data Visualization**: Add chart/graph generation
2. **Report Sharing**: Share reports with other users or teams
3. **Version History**: Track changes to report definitions
4. **Custom Aggregations**: Support SUM, AVG, COUNT aggregations
5. **Joins**: Enable cross-entity reporting with joins
6. **Parameters**: Template-based reports with user-defined parameters
7. **API Export**: Export reports via API webhook
8. **Dashboard Integration**: Embed reports in dashboards
9. **Real-time Reports**: WebSocket-based live updating reports
10. **Report Comments**: Add notes and comments to executions
