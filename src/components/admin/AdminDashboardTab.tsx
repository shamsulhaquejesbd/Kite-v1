import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  DollarSign,
  Package,
  ShoppingBag,
  TrendingUp,
  Truck,
  XCircle,
} from 'lucide-react';
import type { DashboardMetrics } from '../../types/index.ts';
import { formatBDT, formatShortDate } from '../../lib/format.ts';

interface AdminDashboardTabProps {
  token: string;
  currencySymbol: string;
  onQuickJump: (tab: 'orders' | 'products' | 'inventory') => void;
}

export function AdminDashboardTab({
  token,
  currencySymbol,
  onQuickJump,
}: AdminDashboardTabProps) {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch('/api/admin/dashboard', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Failed to load metrics');
        return d;
      })
      .then((d: DashboardMetrics) => setMetrics(d))
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-white border border-slate-200 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
        {error || 'Unable to load dashboard statistics.'}
      </div>
    );
  }

  const maxDaily = Math.max(1, ...metrics.dailySales.map((d) => d.revenue));
  const maxMonthly = Math.max(1, ...metrics.monthlySales.map((m) => m.revenue));
  const totalStatusCount = Math.max(
    1,
    metrics.statusDistribution.reduce((s, item) => s + item.count, 0)
  );

  const kpiCards = [
    { label: 'Total Orders', value: metrics.totalOrders, icon: ShoppingBag, tone: 'text-slate-900' },
    { label: 'Pending Orders', value: metrics.pendingOrders, icon: Clock, tone: 'text-amber-700' },
    { label: 'Confirmed Orders', value: metrics.confirmedOrders, icon: CheckCircle2, tone: 'text-emerald-700' },
    { label: 'Processing Orders', value: metrics.processingOrders, icon: Package, tone: 'text-blue-700' },
    { label: 'Shipped Orders', value: metrics.shippedOrders + metrics.outForDeliveryOrders, icon: Truck, tone: 'text-indigo-700' },
    { label: 'Delivered Orders', value: metrics.deliveredOrders, icon: CheckCircle2, tone: 'text-[#3D732E]' },
    { label: 'Cancelled Orders', value: metrics.cancelledOrders, icon: XCircle, tone: 'text-red-700' },
    { label: 'Total Revenue', value: formatBDT(metrics.totalRevenue, currencySymbol), icon: DollarSign, tone: 'text-[#3D732E]' },
    { label: 'Monthly Revenue', value: formatBDT(metrics.monthlyRevenue, currencySymbol), icon: TrendingUp, tone: 'text-slate-900' },
    { label: 'Total Products', value: metrics.totalProducts, icon: Package, tone: 'text-slate-900' },
    { label: 'Low Stock Products', value: metrics.lowStockProducts, icon: AlertTriangle, tone: 'text-amber-700' },
    { label: 'Out of Stock', value: metrics.outOfStockProducts, icon: XCircle, tone: 'text-red-700' },
  ];

  return (
    <div className="space-y-6">
      {/* 12 Real-time KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-white rounded-xl border border-slate-200 p-4 flex items-start justify-between gap-3"
            >
              <div>
                <p className="text-xs font-medium text-slate-500">{card.label}</p>
                <p className={`mt-1.5 text-2xl font-bold font-mono-tabular ${card.tone}`}>
                  {card.value}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                <Icon className="w-4 h-4 text-slate-600" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Row: Daily Sales + Monthly Sales */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-sans text-sm font-bold text-slate-900">
                Daily Sales (Last 7 Days)
              </h3>
              <p className="text-xs text-slate-500">Revenue & order volume excluding cancelled orders</p>
            </div>
            <button
              type="button"
              onClick={() => onQuickJump('orders')}
              className="text-xs font-semibold text-[#4C8C3B] hover:underline cursor-pointer"
            >
              View Orders
            </button>
          </div>

          <div className="h-52 flex items-end justify-between gap-2 pt-4">
            {metrics.dailySales.map((day) => {
              const pct = Math.max(4, Math.round((day.revenue / maxDaily) * 100));
              return (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                  <span className="text-[10px] font-mono-tabular text-slate-600">
                    {day.revenue > 0 ? formatBDT(day.revenue, currencySymbol) : '—'}
                  </span>
                  <div className="w-full max-w-[44px] bg-slate-100 rounded-t-md h-36 flex items-end overflow-hidden">
                    <div
                      className="w-full bg-[#4C8C3B] rounded-t-md transition-all duration-500"
                      style={{ height: `${day.revenue > 0 ? pct : 3}%` }}
                      title={`${day.date}: ${formatBDT(day.revenue, currencySymbol)} (${day.orders} orders)`}
                    />
                  </div>
                  <span className="text-[11px] font-mono-tabular text-slate-500">
                    {formatShortDate(day.date)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Order Status Distribution */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <h3 className="font-sans text-sm font-bold text-slate-900">
            Order Status Distribution
          </h3>
          <div className="space-y-3">
            {metrics.statusDistribution.map((row) => {
              const pct = Math.round((row.count / totalStatusCount) * 100);
              return (
                <div key={row.status} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-slate-700">{row.status}</span>
                    <span className="font-mono-tabular text-slate-600">
                      {row.count} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        row.status === 'Cancelled'
                          ? 'bg-red-500'
                          : row.status === 'Delivered'
                          ? 'bg-[#4C8C3B]'
                          : 'bg-slate-700'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Monthly Sales & Best-Selling Products */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <h3 className="font-sans text-sm font-bold text-slate-900">Monthly Sales Revenue</h3>
          {metrics.monthlySales.length === 0 ? (
            <p className="text-xs text-slate-500 py-8 text-center">No monthly sales recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {metrics.monthlySales.map((m) => {
                const pct = Math.max(6, Math.round((m.revenue / maxMonthly) * 100));
                return (
                  <div key={m.month} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-mono-tabular font-medium text-slate-700">{m.month}</span>
                      <span className="font-mono-tabular font-semibold text-slate-900">
                        {formatBDT(m.revenue, currencySymbol)} · {m.orders} orders
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full bg-[#4C8C3B] rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-sans text-sm font-bold text-slate-900">Best-Selling Products</h3>
            <button
              type="button"
              onClick={() => onQuickJump('inventory')}
              className="text-xs font-semibold text-[#4C8C3B] hover:underline cursor-pointer"
            >
              Manage Stock
            </button>
          </div>
          {metrics.bestSellingProducts.length === 0 ? (
            <p className="text-xs text-slate-500 py-8 text-center">
              Best sellers will appear as orders are placed.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 font-semibold">Product</th>
                    <th className="py-2 font-semibold text-right">Units Sold</th>
                    <th className="py-2 font-semibold text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {metrics.bestSellingProducts.map((item) => (
                    <tr key={item.product_name}>
                      <td className="py-2.5 font-medium text-slate-900">{item.product_name}</td>
                      <td className="py-2.5 text-right font-mono-tabular text-slate-700">
                        {item.sold_quantity}
                      </td>
                      <td className="py-2.5 text-right font-mono-tabular font-semibold text-slate-900">
                        {formatBDT(item.revenue, currencySymbol)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
