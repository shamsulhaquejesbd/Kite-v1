import { useEffect, useState } from 'react';
import {
  Download,
  Eye,
  MessageCircle,
  Printer,
  Search,
  Send,
  X,
} from 'lucide-react';
import {
  ORDER_STATUSES,
  type Order,
  type OrderStatus,
  type WhatsAppTemplate,
} from '../../types/index.ts';
import {
  buildWhatsAppClickToChatUrl,
  findTemplateForStatus,
  formatBDT,
  formatDateTime,
  interpolateWhatsAppTemplate,
} from '../../lib/format.ts';

interface AdminOrdersTabProps {
  token: string;
  currencySymbol: string;
  templates: WhatsAppTemplate[];
}

export function AdminOrdersTab({
  token,
  currencySymbol,
  templates,
}: AdminOrdersTabProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editWhatsapp, setEditWhatsapp] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // WhatsApp composer modal state (never auto-mutates order status)
  const [waTarget, setWaTarget] = useState<{
    order: Order;
    forStatus: OrderStatus;
    message: string;
  } | null>(null);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/orders', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setOrders(data.orders || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [token]);

  const openOrderDetail = (order: Order) => {
    setSelectedOrder(order);
    setEditNotes(order.internal_notes || '');
    setEditAddress(order.delivery_address || '');
    setEditPhone(order.phone || '');
    setEditWhatsapp(order.whatsapp_number || '');
    setFeedback(null);
  };

  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: newStatus,
          note:
            newStatus === 'Cancelled'
              ? 'Order cancelled by administrator (stock safely restored)'
              : `Status updated to ${newStatus}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not update status.');

      setOrders((prev) => prev.map((o) => (o.id === orderId ? data.order : o)));
      if (selectedOrder?.id === orderId) setSelectedOrder(data.order);
      setFeedback(`Order #${data.order.order_number} marked as ${newStatus}.`);
    } catch (err) {
      setFeedback((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDetails = async () => {
    if (!selectedOrder) return;
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/orders/${selectedOrder.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          internal_notes: editNotes,
          delivery_address: editAddress,
          phone: editPhone,
          whatsapp_number: editWhatsapp,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save order details.');
      setOrders((prev) => prev.map((o) => (o.id === selectedOrder.id ? data.order : o)));
      setSelectedOrder(data.order);
      setFeedback('Customer details and internal notes saved.');
    } catch (err) {
      setFeedback((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const openWhatsAppComposer = (order: Order, forStatus: OrderStatus) => {
    const rawTemplate = findTemplateForStatus(
      templates,
      forStatus,
      order.customer_name,
      order.order_number
    );
    const interpolated = interpolateWhatsAppTemplate(rawTemplate, order, currencySymbol);
    setWaTarget({
      order,
      forStatus,
      message: interpolated,
    });
  };

  const filteredOrders = orders.filter((o) => {
    if (statusFilter !== 'all' && o.status !== statusFilter) return false;
    if (dateFilter && !o.created_at.startsWith(dateFilter)) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const hit =
        o.order_number.toLowerCase().includes(q) ||
        o.customer_name.toLowerCase().includes(q) ||
        o.phone.toLowerCase().includes(q) ||
        o.whatsapp_number.toLowerCase().includes(q);
      if (!hit) return false;
    }
    return true;
  });

  const handleExportCsv = () => {
    const headers = [
      'Order ID',
      'Date',
      'Customer',
      'Phone',
      'WhatsApp',
      'District',
      'Area',
      'Status',
      'Payment',
      'Total BDT',
    ];
    const rows = filteredOrders.map((o) => [
      o.order_number,
      o.created_at,
      `"${o.customer_name.replace(/"/g, '""')}"`,
      o.phone,
      o.whatsapp_number,
      o.district,
      `"${o.area_thana.replace(/"/g, '""')}"`,
      o.status,
      o.payment_method,
      o.total_amount,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `the-kite-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const statusTone = (status: OrderStatus) => {
    switch (status) {
      case 'Delivered':
        return 'text-[#3D732E]';
      case 'Cancelled':
        return 'text-red-700';
      case 'Pending':
        return 'text-amber-700';
      default:
        return 'text-slate-800';
    }
  };

  return (
    <div className="space-y-5">
      {/* Filters & Export Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center gap-3 justify-between">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative min-w-[220px] flex-1 max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Order ID, name, or phone..."
              className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#4C8C3B]"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 bg-white"
          >
            <option value="all">All Statuses</option>
            {ORDER_STATUSES.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-700 bg-white"
          />
          {dateFilter && (
            <button
              type="button"
              onClick={() => setDateFilter('')}
              className="text-xs text-slate-500 hover:text-slate-900 cursor-pointer"
            >
              Clear Date
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
        >
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </button>
      </div>

      {feedback && (
        <div className="px-4 py-2.5 rounded-lg bg-[#EBF3E8] border border-[#C6DFBF] text-xs font-medium text-[#2F5D23]">
          {feedback}
        </div>
      )}

      {/* Orders Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                <th className="px-4 py-3 font-semibold">Order ID</th>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Customer</th>
                <th className="px-4 py-3 font-semibold">Phone</th>
                <th className="px-4 py-3 font-semibold">Products</th>
                <th className="px-4 py-3 font-semibold text-right">Total</th>
                <th className="px-4 py-3 font-semibold">Payment</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-slate-500">
                    Loading orders...
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-slate-500">
                    No matching orders found.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-mono-tabular font-bold text-slate-900 whitespace-nowrap">
                      #{order.order_number}
                    </td>
                    <td className="px-4 py-3 font-mono-tabular text-slate-600 whitespace-nowrap">
                      {formatDateTime(order.created_at)}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {order.customer_name}
                    </td>
                    <td className="px-4 py-3 font-mono-tabular text-slate-700 whitespace-nowrap">
                      {order.phone}
                    </td>
                    <td className="px-4 py-3 text-slate-600 max-w-[200px] truncate">
                      {order.items.map((i) => `${i.product_name} ×${i.quantity}`).join(', ')}
                    </td>
                    <td className="px-4 py-3 font-mono-tabular font-bold text-slate-900 text-right whitespace-nowrap">
                      {formatBDT(order.total_amount, currencySymbol)}
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {order.payment_method}
                    </td>
                    <td className={`px-4 py-3 font-semibold whitespace-nowrap ${statusTone(order.status)}`}>
                      {order.status}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            openWhatsAppComposer(
                              order,
                              order.status === 'Pending' ? 'Confirmed' : order.status
                            )
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-[#EBF3E8] text-[#2F5D23] hover:bg-[#4C8C3B] hover:text-white font-semibold transition-colors cursor-pointer"
                          title="Send WhatsApp message"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          WhatsApp
                        </button>
                        <button
                          type="button"
                          onClick={() => openOrderDetail(order)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 font-semibold cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Manage
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Details & Status Management Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
          <div className="w-full max-w-4xl bg-white rounded-2xl border border-slate-200 shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 no-print">
              <div>
                <h3 className="font-sans text-base font-bold text-slate-900">
                  Order #{selectedOrder.order_number}
                </h3>
                <p className="text-xs text-slate-500">
                  Placed {formatDateTime(selectedOrder.created_at)} · Status: {selectedOrder.status}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Status Action Bar + Dedicated Per-Status WhatsApp Buttons */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3 no-print">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-slate-900">
                      1. Update Order Status (Independent from WhatsApp)
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Cancelling restores inventory safely once. Opening WhatsApp will never change status automatically.
                    </p>
                  </div>
                  <select
                    disabled={saving}
                    value={selectedOrder.status}
                    onChange={(e) =>
                      handleStatusChange(selectedOrder.id, e.target.value as OrderStatus)
                    }
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900"
                  >
                    {ORDER_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pt-3 border-t border-slate-200">
                  <p className="text-xs font-bold text-slate-900 mb-2">
                    2. Dedicated WhatsApp Click-to-Chat Templates ({selectedOrder.whatsapp_number})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(['Confirmed', 'Processing', 'Shipped', 'Out for Delivery', 'Delivered'] as OrderStatus[]).map(
                      (st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => openWhatsAppComposer(selectedOrder, st)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#4C8C3B] hover:bg-[#3D732E] text-white text-xs font-semibold transition-colors cursor-pointer"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          WhatsApp: {st === 'Confirmed' ? 'Confirm Order' : st}
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Customer Information Editor */}
                <div className="space-y-3 border border-slate-200 rounded-xl p-4">
                  <h4 className="text-xs font-bold text-slate-900">Customer & Delivery Details</h4>
                  <div className="text-xs space-y-2">
                    <p>
                      <span className="text-slate-500">Customer:</span>{' '}
                      <strong className="text-slate-900">{selectedOrder.customer_name}</strong>
                    </p>
                    <p>
                      <span className="text-slate-500">District / Area:</span>{' '}
                      <span className="text-slate-900">
                        {selectedOrder.district} — {selectedOrder.area_thana}
                      </span>
                    </p>
                    {selectedOrder.order_notes && (
                      <p className="p-2 rounded bg-amber-50 border border-amber-200 text-amber-900">
                        <strong>Customer Note:</strong> {selectedOrder.order_notes}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 pt-2 no-print">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Phone
                      </label>
                      <input
                        type="text"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-mono-tabular"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        WhatsApp Number
                      </label>
                      <input
                        type="text"
                        value={editWhatsapp}
                        onChange={(e) => setEditWhatsapp(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-mono-tabular"
                      />
                    </div>
                  </div>

                  <div className="no-print">
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Delivery Address
                    </label>
                    <textarea
                      rows={2}
                      value={editAddress}
                      onChange={(e) => setEditAddress(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
                    />
                  </div>

                  <div className="no-print">
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Internal Order Notes
                    </label>
                    <textarea
                      rows={2}
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      placeholder="Courier tracking ID, call verification notes..."
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
                    />
                  </div>

                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleSaveDetails}
                    className="no-print px-4 py-2 rounded-lg bg-slate-900 hover:bg-black text-white text-xs font-semibold cursor-pointer"
                  >
                    Save Updates
                  </button>
                </div>

                {/* Items & Totals */}
                <div className="space-y-4 border border-slate-200 rounded-xl p-4">
                  <h4 className="text-xs font-bold text-slate-900">Order Items</h4>
                  <div className="space-y-2 text-xs">
                    {selectedOrder.items.map((item) => (
                      <div key={item.id} className="flex justify-between gap-2">
                        <span>
                          {item.product_name} ({item.weight_label}) × {item.quantity}
                        </span>
                        <span className="font-mono-tabular font-semibold">
                          {formatBDT(item.line_total, currencySymbol)}
                        </span>
                      </div>
                    ))}
                    <div className="pt-2 border-t border-slate-200 flex justify-between text-slate-600">
                      <span>Subtotal</span>
                      <span className="font-mono-tabular">
                        {formatBDT(selectedOrder.subtotal, currencySymbol)}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Delivery Charge</span>
                      <span className="font-mono-tabular">
                        {formatBDT(selectedOrder.delivery_charge, currencySymbol)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm font-bold text-slate-900 pt-2 border-t border-slate-200">
                      <span>Total Payable ({selectedOrder.payment_method})</span>
                      <span className="font-mono-tabular text-[#3D732E]">
                        {formatBDT(selectedOrder.total_amount, currencySymbol)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Click-to-Chat Composer Modal */}
      {waTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 bg-[#141210] text-white">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-[#7CC267]" />
                <div>
                  <h3 className="text-sm font-bold">
                    WhatsApp Message · {waTarget.forStatus}
                  </h3>
                  <p className="text-[11px] text-[#BDB4A4]">
                    To: {waTarget.order.customer_name} ({waTarget.order.whatsapp_number})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setWaTarget(null)}
                className="p-1 text-[#BDB4A4] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Review or Edit Message Before Opening WhatsApp
                </label>
                <textarea
                  rows={5}
                  value={waTarget.message}
                  onChange={(e) =>
                    setWaTarget({ ...waTarget, message: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#4C8C3B]"
                />
              </div>

              <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-[11px] text-slate-600">
                Opening WhatsApp does not automatically alter the order status. Please update the order status separately in Order Management once you send the message.
              </div>

              <div className="flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setWaTarget(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <a
                  href={buildWhatsAppClickToChatUrl(
                    waTarget.order.whatsapp_number,
                    waTarget.message
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setWaTarget(null)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#4C8C3B] hover:bg-[#3D732E] text-white text-xs font-semibold transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  Open in WhatsApp
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
