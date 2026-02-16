'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, Clock, Menu, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useEDTrackBoard } from '@/hooks/useEmergency';
import { ESI_COLORS, type ESILevel, type EDStatus } from '@/types/emergency';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

const STATUS_LABELS: Record<EDStatus, string> = {
  waiting: 'Esperando',
  triage: 'Triaje',
  in_treatment: 'En Tratamiento',
  disposition: 'Disposición',
  admitted: 'Admitido',
  discharged: 'Alta',
  lwbs: 'Se Fue',
  ama: 'AMA',
  deceased: 'Fallecido',
};

export default function EDTrackBoardPage() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [esiFilter, setEsiFilter] = useState<'all' | '1' | '2' | '3' | '4' | '5' | 'critical'>('all');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const { data: trackBoard, isLoading } = useEDTrackBoard();

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Filter track board items
  const filteredItems = trackBoard?.filter((item) => {
    if (esiFilter === 'all') return true;
    if (esiFilter === 'critical') return item.esi_level <= 2;
    return item.esi_level === Number(esiFilter);
  });

  // Sort by ESI level (critical first), then by arrival time
  const sortedItems = filteredItems?.sort((a, b) => {
    if (a.esi_level !== b.esi_level) {
      return a.esi_level - b.esi_level;
    }
    return new Date(a.arrival_time).getTime() - new Date(b.arrival_time).getTime();
  });

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-primary-foreground hover:bg-primary-foreground/20"
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <AlertCircle className="h-6 w-6" />
              Sala de Emergencia - Track Board
            </h1>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm opacity-90">Hora Actual</p>
          <p className="text-xl font-mono font-bold">
            {currentTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar (optional) */}
        {sidebarOpen && (
          <div className="w-64 bg-muted/30 p-4 overflow-y-auto border-r">
            <h2 className="font-semibold mb-4">Filtros Rápidos</h2>
            <Tabs value={esiFilter} onValueChange={(v: string) => setEsiFilter(v as typeof esiFilter)}>
              <TabsList className="grid grid-cols-1 gap-2 h-auto bg-transparent">
                <TabsTrigger value="all" className="justify-start">
                  Todos ({trackBoard?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="critical" className="justify-start text-red-600">
                  ESI 1-2 (Críticos)
                </TabsTrigger>
                <TabsTrigger value="1" className="justify-start">
                  ESI 1
                </TabsTrigger>
                <TabsTrigger value="2" className="justify-start">
                  ESI 2
                </TabsTrigger>
                <TabsTrigger value="3" className="justify-start">
                  ESI 3
                </TabsTrigger>
                <TabsTrigger value="4" className="justify-start">
                  ESI 4-5
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="mt-6 p-3 bg-primary/10 rounded-lg">
              <div className="flex items-center gap-2 text-primary mb-2">
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                <span className="text-sm font-medium">Actualización automática</span>
              </div>
              <p className="text-xs text-muted-foreground">Cada 10 segundos</p>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 overflow-auto p-6">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-24 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : sortedItems && sortedItems.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="sticky top-0 bg-muted z-10">
                  <tr>
                    <th className="text-left p-3 font-semibold border-b-2">Cama</th>
                    <th className="text-left p-3 font-semibold border-b-2">Paciente</th>
                    <th className="text-left p-3 font-semibold border-b-2">Edad</th>
                    <th className="text-left p-3 font-semibold border-b-2">Motivo de Consulta</th>
                    <th className="text-left p-3 font-semibold border-b-2">ESI</th>
                    <th className="text-left p-3 font-semibold border-b-2">Estado</th>
                    <th className="text-left p-3 font-semibold border-b-2">Arribo</th>
                    <th className="text-left p-3 font-semibold border-b-2">Espera</th>
                    <th className="text-left p-3 font-semibold border-b-2">Door-to-Doc</th>
                    <th className="text-left p-3 font-semibold border-b-2">Médico</th>
                    <th className="text-left p-3 font-semibold border-b-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedItems.map((item) => {
                    const esiColorClass = `bg-${ESI_COLORS[item.esi_level]}/10 border-l-4 border-${ESI_COLORS[item.esi_level]}`;
                    const isCritical = item.esi_level === 1;
                    const isLongWait = item.waiting_time_minutes > 30;

                    return (
                      <tr
                        key={item.visit_id}
                        className={`border-b hover:bg-muted/50 transition-colors ${esiColorClass} ${
                          isCritical ? 'animate-pulse' : ''
                        }`}
                      >
                        <td className="p-3 font-bold text-lg">
                          {item.bed_number || '-'}
                        </td>
                        <td className="p-3 font-medium">
                          {item.patient_name}
                        </td>
                        <td className="p-3">
                          {item.patient_age || '-'}
                        </td>
                        <td className="p-3 max-w-[300px] truncate" title={item.chief_complaint}>
                          {item.chief_complaint}
                        </td>
                        <td className="p-3">
                          <Badge
                            className={`bg-${ESI_COLORS[item.esi_level]} text-white font-bold`}
                          >
                            ESI {item.esi_level}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <Badge variant="outline">
                            {STATUS_LABELS[item.status]}
                          </Badge>
                        </td>
                        <td className="p-3 text-sm">
                          {new Date(item.arrival_time).toLocaleTimeString('es-ES', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="p-3">
                          <span className={isLongWait ? 'text-red-600 font-bold' : ''}>
                            {item.waiting_time_minutes} min
                          </span>
                          {isLongWait && (
                            <Clock className="inline h-4 w-4 ml-1 text-red-600" />
                          )}
                        </td>
                        <td className="p-3">
                          {item.door_to_doc_minutes !== undefined ? (
                            <span className={item.door_to_doc_minutes > 30 ? 'text-red-600 font-bold' : 'text-green-600'}>
                              {item.door_to_doc_minutes} min
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="p-3 text-sm">
                          {item.assigned_physician || '-'}
                        </td>
                        <td className="p-3">
                          <div className="flex gap-1">
                            {item.status === 'waiting' && (
                              <Button size="sm" variant="outline">
                                Triaje
                              </Button>
                            )}
                            {item.status === 'triage' && (
                              <Button size="sm" variant="outline">
                                Asignar MD
                              </Button>
                            )}
                            {(item.status === 'in_treatment' || item.status === 'disposition') && (
                              <Button size="sm" variant="outline">
                                Disposición
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No hay pacientes en la sala de emergencia</p>
                <p className="text-sm text-muted-foreground">
                  Los nuevos arribos aparecerán automáticamente
                </p>
              </CardContent>
            </Card>
          )}

          {/* Summary Footer */}
          {sortedItems && sortedItems.length > 0 && (
            <div className="mt-6 grid grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">Total Pacientes</p>
                  <p className="text-3xl font-bold">{sortedItems.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">ESI 1-2 (Críticos)</p>
                  <p className="text-3xl font-bold text-red-600">
                    {sortedItems.filter((i) => i.esi_level <= 2).length}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">Esperando Triaje</p>
                  <p className="text-3xl font-bold">
                    {sortedItems.filter((i) => i.status === 'waiting').length}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">En Tratamiento</p>
                  <p className="text-3xl font-bold text-blue-600">
                    {sortedItems.filter((i) => i.status === 'in_treatment').length}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
