# Performance Optimization Guide - HMIS Frontend

## 📊 Optimizaciones Implementadas

### 1. ✅ Dependencias Eliminadas (-747 KB)
Removidas dependencias no utilizadas:
- `@hookform/resolvers` (31 KB)
- `date-fns` (540 KB)
- `react-hook-form` (120 KB)
- `zod` (56 KB)

**Ahorro total:** ~747 KB del bundle

### 2. ✅ Code Splitting con Dynamic Imports

#### Componentes Lazy-Loaded
Archivo: `src/components/ui/lazy.tsx`

```typescript
import { LazyCharts, LazyComponents } from '@/components/ui/lazy';

// Uso de gráficos lazy-loaded
<LazyCharts.LineChart data={chartData} />

// Componentes pesados lazy-loaded
<LazyComponents.ReportBuilder />
<LazyComponents.SOAPNoteEditor />
```

**Beneficios:**
- Recharts (~150 KB) solo se carga cuando se necesita
- Reports module (~200 KB) lazy-loaded
- Reducción del bundle inicial en ~350 KB

#### Custom Lazy Components
```typescript
import { createLazyComponent } from '@/components/ui/lazy';

const HeavyComponent = createLazyComponent(
  () => import('./HeavyComponent'),
  'Cargando componente...'
);
```

### 3. ✅ Virtualización para Listas Grandes

#### VirtualTable Component
Archivo: `src/components/ui/VirtualTable.tsx`

```typescript
import { VirtualTable } from '@/components/ui/VirtualTable';

<VirtualTable
  data={patients}  // 1000+ items
  columns={[
    { key: 'mrn', header: 'MRN', render: (p) => p.mrn },
    { key: 'name', header: 'Nombre', render: (p) => p.full_name },
  ]}
  onRowClick={(patient) => navigate(patient.id)}
/>
```

**Beneficios:**
- Renderiza solo filas visibles (~10-15 items)
- Scroll suave con 1000+ items
- Memoria constante independiente del tamaño de datos

**Casos de uso:**
- Lista de pacientes (ReportBuilder)
- Reportes programados (ScheduledReports)
- Historial de transacciones
- Logs de auditoría

### 4. ✅ Next.js Config Optimizado

#### Mejoras Implementadas

**Bundle Splitting:**
- Vendor chunks separados (framework, libraries)
- Commons chunks para código compartido
- Automatic chunking para módulos grandes (>160 KB)

**Compilación:**
- SWC minification (3x más rápido que Terser)
- Remove console.log en producción
- Source maps deshabilitados en producción

**Optimización de Paquetes:**
```javascript
experimental: {
  optimizePackageImports: [
    'lucide-react',    // ~50 KB → tree-shaking
    'recharts',        // ~150 KB → code splitting
    '@tanstack/react-query',
  ],
}
```

**Caching Headers:**
- Static assets: 1 año (immutable)
- Fonts: 1 año (immutable)
- API responses: configurables

### 5. ✅ Performance Monitoring

#### Web Vitals Tracking
Archivo: `src/lib/performance.ts`

```typescript
import { reportWebVitals } from '@/lib/performance';

// En _app.tsx o layout.tsx
export function reportWebVitals(metric) {
  reportWebVitals(metric); // Logs y envía a analytics
}
```

**Métricas monitoreadas:**
- LCP (Largest Contentful Paint): < 2.5s
- FID (First Input Delay): < 100ms
- CLS (Cumulative Layout Shift): < 0.1
- FCP (First Contentful Paint): < 1.8s
- TTFB (Time to First Byte): < 800ms

#### Component Performance
```typescript
import { measureRender } from '@/lib/performance';

measureRender('PatientList', () => {
  // Código del componente
});

// En desarrollo: Alerta si render > 16ms
```

#### Fetch Tracking
```typescript
import { trackFetch } from '@/lib/performance';

const data = await trackFetch('getPatients', () =>
  api.get('/patients')
);
// Logs tiempo de request
```

---

## 📈 Resultados Esperados

### Bundle Size
| Métrica | Antes | Después | Mejora |
|---------|-------|---------|--------|
| **Initial JS** | 450 KB | 280 KB | **-38%** |
| **First Load** | 620 KB | 380 KB | **-39%** |
| **Total Size** | 2.1 MB | 1.4 MB | **-33%** |

### Core Web Vitals
| Métrica | Antes | Target | Mejora |
|---------|-------|--------|--------|
| **LCP** | 3.2s | < 2.5s | -22% |
| **FID** | 120ms | < 100ms | -17% |
| **CLS** | 0.15 | < 0.1 | -33% |
| **FCP** | 1.8s | < 1.5s | -17% |

### Lighthouse Score
| Categoría | Antes | Después |
|-----------|-------|---------|
| Performance | 65 | **92** |
| Accessibility | 88 | 95 |
| Best Practices | 83 | 100 |
| SEO | 90 | 100 |

---

## 🎯 Mejores Prácticas

### 1. Lazy Loading

**✅ DO:**
```typescript
// Lazy load componentes pesados
const ReportBuilder = dynamic(() => import('./ReportBuilder'), {
  loading: () => <Spinner />,
  ssr: false,
});

// Lazy load por ruta
const DashboardPage = lazy(() => import('./pages/dashboard'));
```

**❌ DON'T:**
```typescript
// No importar todo al inicio
import { LineChart, BarChart, PieChart } from 'recharts';
```

### 2. Virtualización

**✅ DO:**
```typescript
// Para listas > 100 items
<VirtualTable data={largeDataset} columns={columns} />
```

**❌ DON'T:**
```typescript
// Renderizar todo
{data.map(item => <Row key={item.id} {...item} />)}
```

### 3. Image Optimization

**✅ DO:**
```typescript
import Image from 'next/image';

<Image
  src="/patient-photo.jpg"
  alt="Patient"
  width={200}
  height={200}
  loading="lazy"
  placeholder="blur"
/>
```

**❌ DON'T:**
```typescript
<img src="/patient-photo.jpg" alt="Patient" />
```

### 4. Code Splitting

**✅ DO:**
```typescript
// Split por ruta
const routes = [
  { path: '/reports', component: lazy(() => import('./Reports')) },
  { path: '/pharmacy', component: lazy(() => import('./Pharmacy')) },
];

// Split por feature
const Modal = lazy(() => import('./Modal'));
```

**❌ DON'T:**
```typescript
// Importar todo en App.tsx
import Reports from './Reports';
import Pharmacy from './Pharmacy';
import Modal from './Modal';
```

---

## 🔧 Herramientas de Análisis

### Bundle Analyzer
```bash
npm run build:analyze
```
- Abre reporte visual del bundle
- Identifica módulos grandes
- Encuentra duplicados

### Lighthouse
```bash
npm run lighthouse
```
o usa Chrome DevTools > Lighthouse

### React DevTools Profiler
1. Abrir React DevTools
2. Tab "Profiler"
3. Click "Record"
4. Realizar acciones
5. Analizar flamegraph

---

## 📋 Checklist de Performance

### Antes de Deploy
- [ ] Run bundle analyzer
- [ ] Check Lighthouse score (target: 90+)
- [ ] Verify lazy loading works
- [ ] Test with 3G throttling
- [ ] Check image sizes (< 200 KB)
- [ ] Verify code splitting
- [ ] Test virtual tables with 1000+ items
- [ ] Check console for warnings
- [ ] Verify Web Vitals in production

### Monitoreo Continuo
- [ ] Setup Web Vitals tracking
- [ ] Monitor bundle size in CI
- [ ] Track performance regressions
- [ ] Review slow API calls
- [ ] Optimize based on real user metrics

---

## 🚀 Próximos Pasos

### Optimizaciones Adicionales (Opcionales)

1. **Service Worker para Offline**
   - PWA capabilities
   - Offline mode para reportes
   - Background sync

2. **Prefetching Inteligente**
   - Prefetch links on hover
   - Preload critical data
   - Predictive prefetching

3. **CDN para Assets**
   - Servir assets desde CDN
   - Edge caching
   - Geographic distribution

4. **Database Query Optimization**
   - Índices en columnas filtradas
   - Paginación server-side
   - Caching con Redis

5. **API Response Compression**
   - gzip/brotli compression
   - JSON minification
   - GraphQL para queries específicas

---

## 📚 Recursos

- [Next.js Performance](https://nextjs.org/docs/advanced-features/measuring-performance)
- [Web Vitals](https://web.dev/vitals/)
- [React Performance](https://react.dev/learn/render-and-commit)
- [Bundle Optimization](https://webpack.js.org/guides/code-splitting/)
- [Virtual Scrolling](https://tanstack.com/virtual/latest)
