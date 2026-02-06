"use client";

const invoices = [
  { id: "FAC-00000012", patient: "Juan Perez", total: "RD$ 4,500.00", status: "paid", date: "06/02/2026", fiscal: "B0200000012" },
  { id: "FAC-00000011", patient: "Maria Rodriguez", total: "RD$ 2,800.00", status: "issued", date: "06/02/2026", fiscal: "B0200000011" },
  { id: "FAC-00000010", patient: "Carlos Gomez", total: "RD$ 12,500.00", status: "partial", date: "05/02/2026", fiscal: "B0100000010" },
  { id: "FAC-00000009", patient: "Ana Gonzalez", total: "RD$ 1,500.00", status: "paid", date: "05/02/2026", fiscal: "B0200000009" },
  { id: "FAC-00000008", patient: "Pedro Sanchez", total: "RD$ 8,200.00", status: "issued", date: "04/02/2026", fiscal: "B0100000008" },
];

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  issued: "bg-blue-100 text-blue-700",
  paid: "bg-green-100 text-green-700",
  partial: "bg-amber-100 text-amber-700",
  cancelled: "bg-red-100 text-red-700",
};
const statusLabels: Record<string, string> = {
  draft: "Borrador", issued: "Emitida", paid: "Pagada", partial: "Parcial", cancelled: "Anulada",
};

export default function BillingPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Facturacion</h1>
          <p className="text-gray-500 mt-1">Gestion de facturas, pagos y reclamaciones</p>
        </div>
        <div className="flex gap-2">
          <button className="border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg font-medium hover:bg-gray-50">Reclamaciones</button>
          <button className="bg-blue-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-blue-700">+ Nueva Factura</button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          ["Ingresos del Mes", "RD$ 487,200", "bg-green-50 text-green-700 border-green-200"],
          ["Facturas Pendientes", "12", "bg-blue-50 text-blue-700 border-blue-200"],
          ["Reclamaciones Abiertas", "8", "bg-amber-50 text-amber-700 border-amber-200"],
          ["Pagos Hoy", "RD$ 29,500", "bg-teal-50 text-teal-700 border-teal-200"],
        ].map(([title, value, color]) => (
          <div key={title} className={`rounded-xl border p-4 ${color}`}>
            <p className="text-sm font-medium opacity-80">{title}</p>
            <p className="text-xl font-bold mt-1">{value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b"><tr>
            <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Factura</th>
            <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">NCF</th>
            <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Paciente</th>
            <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Fecha</th>
            <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Total</th>
            <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Estado</th>
            <th className="px-6 py-3"></th>
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {invoices.map((inv) => (
              <tr key={inv.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm font-mono font-medium text-blue-600">{inv.id}</td>
                <td className="px-6 py-4 text-sm font-mono text-gray-500">{inv.fiscal}</td>
                <td className="px-6 py-4 text-sm font-medium">{inv.patient}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{inv.date}</td>
                <td className="px-6 py-4 text-sm font-medium text-right">{inv.total}</td>
                <td className="px-6 py-4"><span className={`px-2.5 py-1 text-xs font-medium rounded-full ${statusColors[inv.status]}`}>{statusLabels[inv.status]}</span></td>
                <td className="px-6 py-4 text-right"><button className="text-blue-600 text-sm font-medium">Ver</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
