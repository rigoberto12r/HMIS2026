"use client";

const prescriptionQueue = [
  { id: "RX-001", patient: "Juan Perez", medication: "Ibuprofeno 400mg", dosage: "c/8h x 5 dias", qty: 15, prescriber: "Dr. Martinez", status: "pending", alerts: [] },
  { id: "RX-002", patient: "Maria Rodriguez", medication: "Losartan 50mg", dosage: "c/24h", qty: 30, prescriber: "Dr. Martinez", status: "pending", alerts: [] },
  { id: "RX-003", patient: "Carlos Gomez", medication: "Amoxicilina 500mg", dosage: "c/8h x 7 dias", qty: 21, prescriber: "Dra. Lopez", status: "pending", alerts: ["alergia"] },
  { id: "RX-004", patient: "Ana Gonzalez", medication: "Metformina 850mg", dosage: "c/12h", qty: 60, prescriber: "Dr. Martinez", status: "dispensed", alerts: [] },
];

const stockAlerts = [
  { product: "Amoxicilina 500mg", stock: 45, reorder: 100, type: "low" },
  { product: "Omeprazol 20mg", stock: 12, reorder: 50, type: "critical" },
  { product: "Insulina NPH", expiry: "15/03/2026", qty: 8, type: "expiring" },
];

export default function PharmacyPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Farmacia</h1>
          <p className="text-gray-500 mt-1">Dispensacion de medicamentos e inventario</p>
        </div>
        <div className="flex gap-2">
          <button className="border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg font-medium hover:bg-gray-50">Inventario</button>
          <button className="border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg font-medium hover:bg-gray-50">Ordenes de Compra</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cola de prescripciones */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border p-6">
            <h2 className="text-lg font-semibold mb-4">Cola de Prescripciones</h2>
            <div className="space-y-3">
              {prescriptionQueue.map((rx) => (
                <div key={rx.id} className={`border rounded-lg p-4 ${rx.alerts.length > 0 ? "border-red-200 bg-red-50" : "border-gray-200"}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-gray-500">{rx.id}</span>
                        {rx.alerts.length > 0 && (
                          <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full font-medium">ALERTA ALERGIA</span>
                        )}
                      </div>
                      <p className="font-medium text-gray-900 mt-1">{rx.medication}</p>
                      <p className="text-sm text-gray-600">{rx.patient} | {rx.dosage} | Cant: {rx.qty}</p>
                      <p className="text-xs text-gray-400 mt-1">Prescrito por: {rx.prescriber}</p>
                    </div>
                    <div>
                      {rx.status === "pending" ? (
                        <button className="bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal-700">
                          Dispensar
                        </button>
                      ) : (
                        <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">Dispensado</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Alertas de inventario */}
        <div>
          <div className="bg-white rounded-xl border p-6">
            <h2 className="text-lg font-semibold mb-4">Alertas de Inventario</h2>
            <div className="space-y-3">
              {stockAlerts.map((alert, idx) => (
                <div key={idx} className={`p-3 rounded-lg ${alert.type === "critical" ? "bg-red-50 border border-red-200" : alert.type === "expiring" ? "bg-amber-50 border border-amber-200" : "bg-yellow-50 border border-yellow-200"}`}>
                  <p className="text-sm font-medium">{alert.product}</p>
                  {alert.type === "expiring" ? (
                    <p className="text-xs text-amber-600 mt-1">Vence: {alert.expiry} | {alert.qty} unidades</p>
                  ) : (
                    <p className="text-xs mt-1" style={{color: alert.type === "critical" ? "#dc2626" : "#d97706"}}>
                      Stock: {alert.stock} | Reorden: {alert.reorder}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border p-6 mt-4">
            <h3 className="font-semibold text-sm mb-3">Resumen del Dia</h3>
            <div className="space-y-2 text-sm">
              {[["Dispensaciones", "24"], ["Prescripciones pendientes", "4"], ["Sustancias controladas", "2"], ["Lotes por vencer (30d)", "5"]].map(([k, v]) => (
                <div key={k} className="flex justify-between p-2 bg-gray-50 rounded">
                  <span className="text-gray-600">{k}</span>
                  <span className="font-semibold">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
