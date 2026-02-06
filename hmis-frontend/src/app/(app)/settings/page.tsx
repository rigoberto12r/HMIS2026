"use client";

export default function SettingsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Configuracion</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[
          { title: "Datos del Hospital", desc: "Nombre, direccion, logo, informacion fiscal", icon: "🏥" },
          { title: "Usuarios y Roles", desc: "Gestion de cuentas, permisos y accesos", icon: "👥" },
          { title: "Configuracion Fiscal", desc: "NCF, RNC, secuencias de facturacion", icon: "📋" },
          { title: "Plantillas Clinicas", desc: "Templates SOAP por especialidad", icon: "📝" },
          { title: "Horarios y Agenda", desc: "Templates de horario, duracion de consultas", icon: "📅" },
          { title: "Catalogo de Servicios", desc: "Precios, impuestos, codigos CPT", icon: "💰" },
          { title: "Aseguradoras", desc: "Contratos, tarifarios, reglas de adjudicacion", icon: "🛡️" },
          { title: "Integraciones", desc: "APIs externas, FHIR, laboratorios", icon: "🔗" },
        ].map((item) => (
          <div key={item.title} className="bg-white rounded-xl border p-6 hover:border-blue-300 cursor-pointer transition-colors">
            <div className="flex items-start gap-4">
              <span className="text-2xl">{item.icon}</span>
              <div>
                <h3 className="font-semibold text-gray-900">{item.title}</h3>
                <p className="text-sm text-gray-500 mt-1">{item.desc}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
