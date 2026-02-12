'use client';

import { useProducts } from '@/hooks/usePharmacyData';

export function ProductCatalog() {
  const { data: productsData, isLoading } = useProducts({ page: 1, page_size: 20 });

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        <p className="text-sm text-neutral-500">Cargando productos...</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-neutral-900 mb-4">Catálogo de Productos</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {productsData?.items.map((product) => (
          <div
            key={product.id}
            className="p-4 border border-neutral-200 rounded-lg hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-semibold text-neutral-900">{product.name}</h3>
              {product.requires_prescription && (
                <span className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded">Rx</span>
              )}
            </div>
            {product.generic_name && (
              <p className="text-sm text-neutral-500">{product.generic_name}</p>
            )}
            <div className="mt-3 flex gap-2 text-xs text-neutral-500">
              <span className="px-2 py-1 bg-neutral-100 rounded">{product.code}</span>
              <span className="px-2 py-1 bg-neutral-100 rounded">{product.category}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
