'use client';

import { useEffect, useState } from 'react';
import { DollarSign, Calendar, Download, CreditCard, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

const PORTAL_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  subtotal: number;
  tax: number;
  total: number;
  amount_paid: number;
  balance_due: number;
  status: string;
  ncf_number: string | null;
  encounter_date: string | null;
  line_items: LineItem[];
  pdf_url: string | null;
}

interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface Payment {
  id: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  reference_number: string | null;
  invoice_number: string;
}

export default function PortalBillingPage() {
  const [activeTab, setActiveTab] = useState<'invoices' | 'payments'>('invoices');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [unpaidOnly, setUnpaidOnly] = useState(false);

  useEffect(() => {
    if (activeTab === 'invoices') {
      fetchInvoices();
    } else {
      fetchPayments();
    }
  }, [activeTab, unpaidOnly]);

  const fetchInvoices = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('portal_access_token');
      const response = await fetch(
        `${PORTAL_API_URL}/portal/billing/invoices?unpaid_only=${unpaidOnly}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) throw new Error('Failed to load invoices');

      const data = await response.json();
      setInvoices(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPayments = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('portal_access_token');
      const response = await fetch(`${PORTAL_API_URL}/portal/billing/payments`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to load payments');

      const data = await response.json();
      setPayments(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      paid: 'bg-green-100 text-green-700',
      pending: 'bg-yellow-100 text-yellow-700',
      partially_paid: 'bg-orange-100 text-orange-700',
      overdue: 'bg-red-100 text-red-700',
    };
    return colors[status] || 'bg-neutral-100 text-neutral-700';
  };

  const totalOutstanding = invoices.reduce((sum, inv) => sum + inv.balance_due, 0);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900 mb-2">Billing & Payments</h1>
        <p className="text-neutral-600">View invoices and payment history</p>
      </div>

      {/* Summary Card */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl p-6 text-white mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-green-100 mb-1">Total Outstanding Balance</p>
            <p className="text-3xl font-bold">${totalOutstanding.toFixed(2)}</p>
          </div>
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
            <DollarSign className="w-8 h-8" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-2 border-b border-neutral-200">
        <button
          onClick={() => setActiveTab('invoices')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'invoices'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-neutral-600 hover:text-neutral-900'
          }`}
        >
          Invoices
        </button>
        <button
          onClick={() => setActiveTab('payments')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'payments'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-neutral-600 hover:text-neutral-900'
          }`}
        >
          Payment History
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Invoices */}
          {activeTab === 'invoices' && (
            <>
              <div className="mb-4 flex gap-2">
                <button
                  onClick={() => setUnpaidOnly(false)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    !unpaidOnly
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-neutral-600 border border-neutral-200'
                  }`}
                >
                  All Invoices
                </button>
                <button
                  onClick={() => setUnpaidOnly(true)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    unpaidOnly
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-neutral-600 border border-neutral-200'
                  }`}
                >
                  Unpaid Only
                </button>
              </div>

              <div className="space-y-4">
                {invoices.length === 0 ? (
                  <div className="bg-white rounded-xl border border-neutral-200 p-12 text-center">
                    <FileText className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
                    <p className="text-neutral-500">No invoices found</p>
                  </div>
                ) : (
                  invoices.map((invoice) => (
                    <div key={invoice.id} className="bg-white rounded-xl border border-neutral-200 p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="font-semibold text-neutral-900">
                            Invoice #{invoice.invoice_number}
                          </h3>
                          <div className="flex items-center gap-4 mt-1 text-sm text-neutral-500">
                            <span>Issued: {new Date(invoice.invoice_date).toLocaleDateString()}</span>
                            <span>Due: {new Date(invoice.due_date).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(invoice.status)}`}>
                          {invoice.status.replace('_', ' ')}
                        </span>
                      </div>

                      {/* Line Items */}
                      <div className="border-t border-neutral-200 pt-4 mb-4">
                        {invoice.line_items.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-sm mb-2">
                            <span className="text-neutral-700">
                              {item.description} (x{item.quantity})
                            </span>
                            <span className="font-medium text-neutral-900">${item.total.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>

                      {/* Totals */}
                      <div className="border-t border-neutral-200 pt-4 space-y-1 text-sm">
                        <div className="flex justify-between text-neutral-600">
                          <span>Subtotal</span>
                          <span>${invoice.subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-neutral-600">
                          <span>Tax</span>
                          <span>${invoice.tax.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between font-semibold text-neutral-900 text-base pt-2 border-t">
                          <span>Total</span>
                          <span>${invoice.total.toFixed(2)}</span>
                        </div>
                        {invoice.amount_paid > 0 && (
                          <>
                            <div className="flex justify-between text-green-600">
                              <span>Amount Paid</span>
                              <span>-${invoice.amount_paid.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between font-semibold text-neutral-900 text-base">
                              <span>Balance Due</span>
                              <span>${invoice.balance_due.toFixed(2)}</span>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-3 mt-4 pt-4 border-t border-neutral-200">
                        {invoice.pdf_url && (
                          <Button size="sm" variant="outline">
                            <Download className="w-4 h-4 mr-2" />
                            Download PDF
                          </Button>
                        )}
                        {invoice.balance_due > 0 && (
                          <Button size="sm" className="bg-green-600 hover:bg-green-700">
                            <CreditCard className="w-4 h-4 mr-2" />
                            Pay Now
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {/* Payments */}
          {activeTab === 'payments' && (
            <div className="space-y-4">
              {payments.length === 0 ? (
                <div className="bg-white rounded-xl border border-neutral-200 p-12 text-center">
                  <CreditCard className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
                  <p className="text-neutral-500">No payment history found</p>
                </div>
              ) : (
                payments.map((payment) => (
                  <div key={payment.id} className="bg-white rounded-xl border border-neutral-200 p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex gap-4">
                        <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                          <CreditCard className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-neutral-900">
                            Payment for Invoice #{payment.invoice_number}
                          </h3>
                          <div className="flex items-center gap-4 mt-1 text-sm text-neutral-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              {new Date(payment.payment_date).toLocaleDateString()}
                            </span>
                            <span className="capitalize">{payment.payment_method.replace('_', ' ')}</span>
                            {payment.reference_number && (
                              <span className="font-mono">Ref: {payment.reference_number}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-green-600">${payment.amount.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}

      {/* Info Box */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-1">Payment Information</h3>
        <p className="text-sm text-blue-800">
          For questions about billing or to arrange payment plans, please contact our billing department at
          (123) 456-7890 or billing@hospital.com
        </p>
      </div>
    </div>
  );
}
