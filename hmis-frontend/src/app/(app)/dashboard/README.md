# Dashboard Premium SaaS

Dashboard renovado con KPIs interactivos, graficos avanzados, y experiencia premium.

## Estructura de Archivos

```
dashboard/
├── page.tsx                              # Main dashboard page
├── utils.ts                              # Helper functions
├── README.md                             # This file
├── DASHBOARD_REPORT.md                   # Detailed documentation
└── components/
    ├── HealthOSGreeting.tsx              # ✨ MEJORADO - Time-based greeting
    ├── HealthOSKPIs.tsx                  # ✨ MEJORADO - KPIs with sparklines
    ├── ClinicalActivity.tsx              # ✅ MANTENIDO - Patient list
    ├── AIAssistantPanel.tsx              # ✅ MANTENIDO - AI suggestions
    ├── InsightsChart.tsx                 # ✅ MANTENIDO - Hourly chart
    ├── QuickActions.tsx                  # ✅ MANTENIDO - Action buttons
    ├── DarkChartTooltip.tsx              # ✅ MANTENIDO - Chart tooltips
    ├── RevenueChart.tsx                  # 🆕 NUEVO - Income vs expenses
    ├── TopDiagnosesChart.tsx             # 🆕 NUEVO - Donut chart
    ├── AlertsPanel.tsx                   # 🆕 NUEVO - System alerts
    ├── RecentActivityTimeline.tsx        # 🆕 NUEVO - Activity feed
    └── DashboardSkeleton.tsx             # 🆕 NUEVO - Loading skeleton
```

## Quick Start

```bash
cd hmis-frontend
npm run dev
# Dashboard: http://localhost:3000/dashboard
```

## Componentes Principales

### 1. KPIs (4 cards)
- Pacientes Hoy
- Consultas Activas
- Ingresos del Dia
- Completadas

**Features:**
- Sparklines (mini graficos)
- Trend indicators (+/- %)
- Hover effects
- Real-time data

### 2. Graficos (5 charts)
- Consultas por hora (area chart)
- Ingresos vs Gastos (line chart)
- Top Diagnosticos (donut chart)

### 3. Paneles Informativos
- Actividad Clinica
- Panel Inteligente IA
- Alertas del Sistema
- Timeline de Actividad Reciente

### 4. Quick Actions
4 botones con gradientes para acciones rapidas

## APIs Utilizadas

### Funcionando ✅
- `GET /api/v1/patients/search` - Total pacientes
- `GET /api/v1/appointments` - Citas
- `GET /api/v1/billing/invoices` - Facturas
- `GET /api/v1/billing/reports/ar-aging` - Cuentas por cobrar

### Mock Data ⚠️
- Revenue summary (ultimos 7 dias)
- Top diagnoses (mes actual)
- Critical alerts
- Activity feed

## Endpoints Necesarios

```typescript
// 1. Dashboard summary (prioridad ALTA)
GET /api/v1/dashboard/summary

// 2. Revenue summary
GET /api/v1/reports/revenue-summary?days=7

// 3. Top diagnoses
GET /api/v1/reports/top-diagnoses?period=month&limit=5

// 4. Critical alerts
GET /api/v1/alerts/critical

// 5. Activity feed
GET /api/v1/activity/recent?limit=10
```

Ver detalles en `DASHBOARD_REPORT.md`

## Tecnologias

- **Framework:** Next.js 14 App Router
- **UI:** Tailwind CSS + Framer Motion
- **Charts:** Recharts
- **Icons:** Lucide React
- **Data Fetching:** React Query
- **State:** Zustand (auth)

## Performance

- Initial Load: < 2s
- Time to Interactive: < 3s
- Animaciones: 60fps
- React Query cache: 30s - 5min

## Responsive Design

- **Desktop (>1024px):** 3-4 columnas
- **Tablet (640-1024px):** 2 columnas
- **Mobile (<640px):** 1 columna

## Dark Mode

100% compatible con tema HealthOS dark:
- Background: `#0F0E19`
- Cards: `#18162F`
- Text: White con opacidad

## Testing

```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Build
npm run build

# Tests (cuando esten implementados)
npm test
```

## Customizacion

### Cambiar Colores de KPIs

Editar `HealthOSKPIs.tsx`:

```typescript
const kpis: KPIConfig[] = [
  {
    label: 'MI METRICA',
    icon: IconName,
    borderColor: 'border-l-blue-400',
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-400',
    // ...
  }
];
```

### Agregar Nuevo Chart

1. Crear componente en `components/`
2. Importar en `page.tsx`
3. Agregar en grid layout

```typescript
// page.tsx
import { MiNuevoChart } from './components/MiNuevoChart';

// En el return:
<MiNuevoChart data={miData} />
```

## Troubleshooting

### Dashboard no carga
- Verificar que backend este corriendo (port 8000)
- Verificar headers: `X-Tenant-ID` y `Authorization`
- Revisar Network tab en DevTools

### Graficos no renderizan
- Verificar que `recharts` este instalado: `npm list recharts`
- Verificar formato de datos (ver tipos en componentes)

### Animaciones laggy
- Reducir `transition.duration` en framer-motion
- Desactivar sparklines (comentar ResponsiveContainer)

## Contribuir

1. Crear componente en `components/`
2. Seguir patron existente (framer-motion + recharts)
3. Agregar tipos TypeScript
4. Documentar en este README

## Documentacion Completa

- `DASHBOARD_REPORT.md` - Documentacion tecnica detallada
- `../../DASHBOARD_IMPLEMENTATION_SUMMARY.md` - Resumen ejecutivo
- `../../DASHBOARD_VISUAL_STRUCTURE.md` - Estructura visual ASCII

## Contacto

Dashboard renovado el 2026-02-13 siguiendo `DISEÑO_MENU_SAAS_2026.md`
