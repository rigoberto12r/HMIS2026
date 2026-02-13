'use client';

import { useState } from 'react';
import { Card, KpiCard } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/ui/data-table';
import { StatusBadge, Badge } from '@/components/ui/badge';
import {
  Shield,
  Clock,
  CheckCircle,
  XCircle,
  Send,
  Eye,
  FileText,
  Filter,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useInsuranceClaims,
  useSubmitClaim,
  useUpdateClaimStatus,
  type InsuranceClaim,
} from '@/hooks/useInvoices';

// ─── Types ──────────────────────────────────────────────

interface ClaimFilters {
  status: string;
  insurer: string;
  dateFrom: string;
  dateTo: string;
}

// ─── Component ──────────────────────────────────────────

const formatRD = (amount: number) =>
  `RD$ ${amount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`;

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-DO', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const statusMap: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' | 'info' }> = {
  draft: { label: 'Borrador', variant: 'default' },
  submitted: { label: 'Enviado', variant: 'info' },
  approved: { label: 'Aprobado', variant: 'success' },
  rejected: { label: 'Rechazado', variant: 'danger' },
  paid: { label: 'Pagado', variant: 'success' },
};

export default function InsurancePage() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<ClaimFilters>({
    status: '',
    insurer: '',
    dateFrom: '',
    dateTo: '',
  });
  const [selectedClaim, setSelectedClaim] = useState<InsuranceClaim | null>(null);

  const { data, isLoading, refetch } = useInsuranceClaims({ page, page_size: 10, status: filters.status });
  const submitClaimMutation = useSubmitClaim();
  const updateStatusMutation = useUpdateClaimStatus();

  const claims = data?.items || [];
  const total = data?.total || 0;

  // Calculate stats
  const stats = {
    total_claims: total,
    pending: claims.filter((c) => c.status === 'submitted').length,
    approved: claims.filter((c) => c.status === 'approved').length,
    rejected: claims.filter((c) => c.status === 'rejected').length,
    total_amount: claims.reduce((sum, c) => sum + c.claim_amount, 0),
    approved_amount: claims
      .filter((c) => c.status === 'approved')
      .reduce((sum, c) => sum + (c.approved_amount || 0), 0),
  };

  const handleSubmitClaim = async (claimId: string) => {
    try {
      await submitClaimMutation.mutateAsync(claimId);
      toast.success('Reclamación enviada a la aseguradora');
      refetch();
    } catch (error) {
      toast.error('Error al enviar la reclamación');
    }
  };

  const handleApproveClaim = async (claimId: string, approvedAmount: number) => {
    try {
      await updateStatusMutation.mutateAsync({
        claimId,
        status: 'approved',
        approvedAmount,
      });
      toast.success('Reclamación aprobada');
      refetch();
    } catch (error) {
      toast.error('Error al aprobar la reclamación');
    }
  };

  const handleRejectClaim = async (claimId: string, reason: string) => {
    try {
      await updateStatusMutation.mutateAsync({
        claimId,
        status: 'rejected',
        rejectionReason: reason,
      });
      toast.success('Reclamación rechazada');
      refetch();
    } catch (error) {
      toast.error('Error al rechazar la reclamación');
    }
  };

  const columns: Column<InsuranceClaim>[] = [
    {
      key: 'claim_number',
      header: 'Número',
      render: (claim) => (
        <span className="font-mono text-sm text-neutral-600 dark:text-neutral-400">
          {claim.claim_number}
        </span>
      ),
    },
    {
      key: 'patient_name',
      header: 'Paciente',
      render: (claim) => claim.patient_name || '-',
    },
    {
      key: 'insurer_name',
      header: 'Aseguradora',
      render: (claim) => (
        <Badge variant="info">
          <Shield className="w-3 h-3 mr-1" />
          {claim.insurer_name}
        </Badge>
      ),
    },
    {
      key: 'claim_amount',
      header: 'Monto Reclamado',
      render: (claim) => <span className="font-semibold">{formatRD(claim.claim_amount)}</span>,
    },
    {
      key: 'approved_amount',
      header: 'Monto Aprobado',
      render: (claim) =>
        claim.approved_amount ? (
          <span className="text-green-600 dark:text-green-400 font-semibold">
            {formatRD(claim.approved_amount)}
          </span>
        ) : (
          '-'
        ),
    },
    {
      key: 'status',
      header: 'Estado',
      render: (claim) => {
        const status = statusMap[claim.status] || { label: claim.status, variant: 'default' };
        return <StatusBadge status={status.label} />;
      },
    },
    {
      key: 'submission_date',
      header: 'Fecha Envío',
      render: (claim) => formatDate(claim.submission_date),
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (claim) => (
        <div className="flex gap-2">
          {claim.status === 'draft' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleSubmitClaim(claim.id)}
              disabled={submitClaimMutation.isPending}
            >
              <Send className="w-4 h-4 mr-1" />
              Enviar
            </Button>
          )}
          {claim.status === 'submitted' && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleApproveClaim(claim.id, claim.claim_amount)}
                disabled={updateStatusMutation.isPending}
              >
                <CheckCircle className="w-4 h-4 mr-1" />
                Aprobar
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleRejectClaim(claim.id, 'Rechazado por validación')}
                disabled={updateStatusMutation.isPending}
              >
                <XCircle className="w-4 h-4 mr-1" />
                Rechazar
              </Button>
            </>
          )}
          <Button size="sm" variant="ghost" onClick={() => setSelectedClaim(claim)}>
            <Eye className="w-4 h-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Gestión de Seguros / ARS</h1>
          <p className="text-neutral-500">
            Administración de reclamaciones a aseguradoras y ARS
          </p>
        </div>
        <Button>
          <FileText className="w-4 h-4 mr-2" />
          Nueva Reclamación
        </Button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Reclamaciones"
          value={stats.total_claims.toString()}
          icon={Shield}
          variant="default"
          loading={isLoading}
        />
        <KpiCard
          title="Pendientes"
          value={stats.pending.toString()}
          icon={Clock}
          variant="warning"
          loading={isLoading}
        />
        <KpiCard
          title="Aprobadas"
          value={stats.approved.toString()}
          icon={CheckCircle}
          variant="success"
          loading={isLoading}
        />
        <KpiCard
          title="Rechazadas"
          value={stats.rejected.toString()}
          icon={XCircle}
          variant="danger"
          loading={isLoading}
        />
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <div className="p-6">
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">
              Monto Total Reclamado
            </p>
            <p className="text-3xl font-bold">{formatRD(stats.total_amount)}</p>
          </div>
        </Card>
        <Card>
          <div className="p-6">
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">
              Monto Total Aprobado
            </p>
            <p className="text-3xl font-bold text-green-600 dark:text-green-400">
              {formatRD(stats.approved_amount)}
            </p>
            <p className="text-xs text-neutral-500 mt-1">
              Tasa de aprobación:{' '}
              {stats.total_amount > 0
                ? ((stats.approved_amount / stats.total_amount) * 100).toFixed(1)
                : 0}
              %
            </p>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <div className="p-4">
          <div className="flex items-center gap-4">
            <Filter className="w-5 h-5 text-neutral-500" />
            <div className="flex-1 flex gap-4">
              <select
                className="px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800"
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              >
                <option value="">Todos los estados</option>
                <option value="draft">Borrador</option>
                <option value="submitted">Enviado</option>
                <option value="approved">Aprobado</option>
                <option value="rejected">Rechazado</option>
                <option value="paid">Pagado</option>
              </select>
              <input
                type="date"
                className="px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800"
                value={filters.dateFrom}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                placeholder="Desde"
              />
              <input
                type="date"
                className="px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800"
                value={filters.dateTo}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                placeholder="Hasta"
              />
              <Button variant="outline" onClick={() => refetch()}>
                Aplicar Filtros
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Claims Table */}
      <Card>
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4">Reclamaciones</h2>
          <DataTable
            data={claims}
            columns={columns}
            keyExtractor={(claim) => claim.id}
            loading={isLoading}
            emptyMessage="No hay reclamaciones registradas"
          />
        </div>
      </Card>

      {/* Pagination */}
      {total > 10 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>
            Anterior
          </Button>
          <span className="px-4 py-2">
            Página {page} de {Math.ceil(total / 10)}
          </span>
          <Button
            variant="outline"
            disabled={page >= Math.ceil(total / 10)}
            onClick={() => setPage(page + 1)}
          >
            Siguiente
          </Button>
        </div>
      )}

      {/* Claim Detail Modal */}
      {selectedClaim && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="max-w-2xl w-full mx-4">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-xl font-bold">Detalle de Reclamación</h2>
                  <p className="text-sm text-neutral-500">
                    {selectedClaim.claim_number}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedClaim(null)}>
                  <XCircle className="w-5 h-5" />
                </Button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-neutral-500">Paciente</p>
                    <p className="font-semibold">{selectedClaim.patient_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-neutral-500">Aseguradora</p>
                    <p className="font-semibold">{selectedClaim.insurer_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-neutral-500">Monto Reclamado</p>
                    <p className="font-semibold">{formatRD(selectedClaim.claim_amount)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-neutral-500">Estado</p>
                    <StatusBadge
                      status={statusMap[selectedClaim.status]?.label || selectedClaim.status}
                    />
                  </div>
                  <div>
                    <p className="text-sm text-neutral-500">Fecha de Envío</p>
                    <p className="font-semibold">{formatDate(selectedClaim.submission_date)}</p>
                  </div>
                  {selectedClaim.approved_amount && (
                    <div>
                      <p className="text-sm text-neutral-500">Monto Aprobado</p>
                      <p className="font-semibold text-green-600">
                        {formatRD(selectedClaim.approved_amount)}
                      </p>
                    </div>
                  )}
                  {selectedClaim.rejection_reason && (
                    <div className="col-span-2">
                      <p className="text-sm text-neutral-500">Razón de Rechazo</p>
                      <p className="text-red-600">{selectedClaim.rejection_reason}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
