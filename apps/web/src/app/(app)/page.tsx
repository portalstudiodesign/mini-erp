"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatDay, formatDateTime, formatMoney, STATUS_LABEL, STATUS_TONE } from "@/lib/format";
import { useMe } from "@/lib/hooks";
import type { Dashboard } from "@/lib/types";
import { Badge, Card, ErrorBox, PageHeader } from "@/components/ui";

function Kpi({ label, value, hint, href }: { label: string; value: string | number; hint?: string; href?: string }) {
  const body = (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-xs transition-colors hover:border-zinc-300">
      <div className="text-sm text-zinc-500">{label}</div>
      <div className="tabular mt-1 text-2xl font-semibold tracking-tight">{value}</div>
      {hint && <div className="mt-1 text-xs text-zinc-500">{hint}</div>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function RevenueChart({ data }: { data: Dashboard["revenueByDay"] }) {
  const max = Math.max(...data.map((d) => d.total), 1);
  return (
    <div className="px-4 pb-4 pt-6">
      <div className="flex h-40 items-end gap-1.5">
        {data.map((d) => (
          <div key={d.date} className="group relative flex h-full flex-1 flex-col justify-end">
            <div
              className="rounded-t bg-brand-500/80 transition-colors group-hover:bg-brand-600"
              style={{ height: `${Math.max((d.total / max) * 100, d.total ? 2 : 0)}%` }}
            />
            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-zinc-900 px-2 py-1 text-xs text-white group-hover:block">
              {formatDay(d.date)}: {formatMoney(d.total)} · {d.orders} com.
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-zinc-400">
        <span>{formatDay(data[0]!.date)}</span>
        <span>azi</span>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: me } = useMe();
  const { data, error } = useQuery({ queryKey: ["dashboard"], queryFn: () => api<Dashboard>("/dashboard") });

  return (
    <>
      <PageHeader title={me ? `Bună, ${me.user.name.split(" ")[0]}` : "Panou"} subtitle="Situația comenzilor și a stocului" />
      <ErrorBox error={error} />
      {data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Vânzări 30 de zile" value={formatMoney(data.revenue30d.total)} hint={`${data.revenue30d.orders} comenzi confirmate`} />
            <Kpi label="De confirmat" value={data.ordersByStatus.PENDING ?? 0} href="/comenzi?status=PENDING" />
            <Kpi label="De expediat" value={data.ordersByStatus.CONFIRMED ?? 0} href="/comenzi?status=CONFIRMED" />
            <Kpi label="Alerte de stoc" value={data.openAlerts.count} href="/stoc" />
          </div>

          <Card title="Vânzări pe ultimele 14 zile">
            <RevenueChart data={data.revenueByDay} />
          </Card>

          <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
            <Card title="Comenzi recente" action={<Link href="/comenzi" className="text-sm text-brand-700 hover:underline">Toate</Link>}>
              <ul className="divide-y divide-zinc-100">
                {data.recentOrders.map((o) => (
                  <li key={o.id}>
                    <Link href={`/comenzi/${o.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50">
                      <span className="tabular w-12 text-sm text-zinc-500">#{o.id}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{o.customer.name}</span>
                        <span className="block text-xs text-zinc-500">{formatDateTime(o.createdAt)}</span>
                      </span>
                      <span className="tabular text-sm">{formatMoney(o.total)}</span>
                      <Badge tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>

            <Card title="Produse sub stocul minim">
              {data.openAlerts.items.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-zinc-500">Toate produsele sunt peste stocul minim.</p>
              ) : (
                <ul className="divide-y divide-zinc-100">
                  {data.openAlerts.items.map((a) => (
                    <li key={a.id} className="flex items-center gap-3 px-4 py-3">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{a.product.name}</span>
                        <span className="block text-xs text-zinc-500">{a.product.sku}</span>
                      </span>
                      <span className="tabular text-sm">
                        <span className="font-semibold text-red-600">{a.product.stock}</span>
                        <span className="text-zinc-400"> / min {a.product.minStock} {a.product.unit}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
