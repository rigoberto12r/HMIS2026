/**
 * Inventory Page - Stock management and alerts
 * Real-time inventory tracking with low stock warnings
 */

'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/input';
import { useProducts, useInventoryAlerts } from '@/hooks/usePharmacyData';
import {
  Search,
  Filter,
  AlertTriangle,
  Package,
  TrendingDown,
  TrendingUp,
  Calendar,
  BarChart3,
  Download,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

const categoryOptions = [
  { value: '', label: 'Todas las categorías' },
  { value: 'antibiotics', label: 'Antibióticos' },
  { value: 'analgesics', label: 'Analgésicos' },
  { value: 'cardiovascular', label: 'Cardiovascular' },
  { value: 'diabetes', label: 'Diabetes' },
  { value: 'respiratory', label: 'Respiratorio' },
  { value: 'other', label: 'Otros' },
];

const stockStatusOptions = [
  { value: '', label: 'Todos los estados' },
  { value: 'critical', label: 'Stock Crítico' },
  { value: 'low', label: 'Stock Bajo' },
  { value: 'normal', label: 'Stock Normal' },
  { value: 'high', label: 'Stock Alto' },
];

export default function InventoryPage() {
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [stockFilter, setStockFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const { data: productsData, isLoading, refetch } = useProducts({
    page,
    page_size: 50,
    search: searchTerm || undefined,
    category: categoryFilter || undefined,
  });

  const { data: alerts } = useInventoryAlerts();

  const products = productsData?.items || [];
  const total = productsData?.total || 0;
  const totalPages = Math.ceil(total / 50);

  // Calculate inventory stats
  const criticalStock = products.filter(p => p.min_stock > 0 && (p.min_stock * 0.5) > 0).length;
  const lowStock = products.filter(p => p.reorder_point > 0 && p.min_stock > 0).length;
  const totalValue = products.reduce((sum, p) => sum + (p.min_stock * 100), 0); // Mock value

  const getStockStatus = (product: typeof products[0]) => {
    // Mock current stock - in real app this would come from backend
    const currentStock = product.min_stock || 0;
    const reorderPoint = product.reorder_point || 0;

    if (currentStock === 0) return 'critical';
    if (currentStock < reorderPoint) return 'low';
    if (currentStock < product.max_stock * 0.5) return 'normal';
    return 'high';
  };

  const getStockBadge = (status: string) => {
    const styles = {
      critical: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      low: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
      normal: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      high: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    };

    const labels = {
      critical: 'Crítico',
      low: 'Bajo',
      normal: 'Normal',
      high: 'Alto',
    };

    const icons = {
      critical: AlertTriangle,
      low: TrendingDown,
      normal: Package,
      high: TrendingUp,
    };

    const Icon = icons[status as keyof typeof icons] || Package;

    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${styles[status as keyof typeof styles]}`}>
        <Icon className="w-3 h-3" />
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  const filteredProducts = products.filter(product => {
    if (!stockFilter) return true;
    return getStockStatus(product) === stockFilter;
  });

  const handleExport = () => {
    toast.success('Exportando reporte de inventario...');
    // In real app: download CSV/Excel
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">
            Control de Inventario
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Monitoreo de stock y alertas de reabastecimiento
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => refetch()}
            leftIcon={<RefreshCw className="w-4 h-4" />}
          >
            Actualizar
          </Button>
          <Button
            variant="primary"
            onClick={handleExport}
            leftIcon={<Download className="w-4 h-4" />}
          >
            Exportar
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Productos Activos
              </p>
              <p className="text-2xl font-bold text-primary-600 dark:text-primary-500 mt-1">
                {total}
              </p>
            </div>
            <div className="p-3 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
              <Package className="w-6 h-6 text-primary-600 dark:text-primary-500" />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Stock Crítico
              </p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-500 mt-1">
                {alerts?.filter(a => a.alert_type === 'low_stock').length || criticalStock}
              </p>
            </div>
            <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-500" />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Stock Bajo
              </p>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-500 mt-1">
                {lowStock}
              </p>
            </div>
            <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
              <TrendingDown className="w-6 h-6 text-amber-600 dark:text-amber-500" />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Valor Total (Est.)
              </p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-500 mt-1">
                ${totalValue.toLocaleString()}
              </p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <BarChart3 className="w-6 h-6 text-green-600 dark:text-green-500" />
            </div>
          </div>
        </Card>
      </div>

      {/* Critical Alerts Banner */}
      {alerts && alerts.length > 0 && (
        <Card className="p-4 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-red-900 dark:text-red-400 mb-2">
                Alertas de Inventario Activas ({alerts.length})
              </h3>
              <div className="space-y-1">
                {alerts.slice(0, 3).map((alert, idx) => (
                  <p key={idx} className="text-xs text-red-800 dark:text-red-400">
                    • <span className="font-medium">{alert.product_name}</span>: {alert.detail}
                  </p>
                ))}
                {alerts.length > 3 && (
                  <p className="text-xs text-red-700 dark:text-red-500 font-medium">
                    + {alerts.length - 3} alertas más
                  </p>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder="Buscar por nombre o código..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>
          <div className="w-full md:w-48">
            <Select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              options={categoryOptions}
            />
          </div>
          <div className="w-full md:w-48">
            <Select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value)}
              options={stockStatusOptions}
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            leftIcon={<Filter className="w-4 h-4" />}
          >
            Más Filtros
          </Button>
        </div>

        {showFilters && (
          <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Stock mínimo"
              type="number"
              placeholder="0"
            />
            <Input
              label="Stock máximo"
              type="number"
              placeholder="1000"
            />
            <div className="flex items-end">
              <Button variant="outline" className="w-full">
                Aplicar
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Inventory Table */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Cargando inventario...
            </p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-neutral-300 dark:text-neutral-600 mx-auto mb-3" />
            <p className="text-neutral-500 dark:text-neutral-400">
              No se encontraron productos
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    Producto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    Categoría
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    Stock Actual
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    Punto de Reorden
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    Stock Máx
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-neutral-900 divide-y divide-neutral-200 dark:divide-neutral-700">
                {filteredProducts.map((product) => {
                  const status = getStockStatus(product);
                  const currentStock = product.min_stock || 0; // Mock - would come from backend

                  return (
                    <tr
                      key={product.id}
                      className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                            {product.name}
                          </div>
                          <div className="text-xs text-neutral-500 dark:text-neutral-400">
                            {product.code} {product.generic_name && `• ${product.generic_name}`}
                          </div>
                          {product.is_controlled && (
                            <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 rounded">
                              Controlado
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-neutral-700 dark:text-neutral-300">
                          {product.category || 'Sin categoría'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`text-sm font-semibold ${
                          status === 'critical' ? 'text-red-600 dark:text-red-500' :
                          status === 'low' ? 'text-amber-600 dark:text-amber-500' :
                          'text-neutral-900 dark:text-neutral-100'
                        }`}>
                          {currentStock}
                        </span>
                        <span className="text-xs text-neutral-500 ml-1">
                          {product.unit}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="text-sm text-neutral-600 dark:text-neutral-400">
                          {product.reorder_point}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="text-sm text-neutral-600 dark:text-neutral-400">
                          {product.max_stock}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {getStockBadge(status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toast.info('Ver movimientos de inventario')}
                          >
                            Movimientos
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toast.info('Ajustar inventario')}
                          >
                            Ajustar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Mostrando {filteredProducts.length} de {total} productos
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
            >
              Anterior
            </Button>
            <span className="px-4 py-2 text-sm text-neutral-700 dark:text-neutral-300">
              Página {page} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page + 1)}
              disabled={page === totalPages}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
