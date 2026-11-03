"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Banknote,
  Hourglass,
  PackageCheck,
  Plus,
  TriangleAlert,
  Truck,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { api } from "@/lib/api";
import {
  formatAmount,
  formatCompact,
  formatDateTime,
  formatDay,
  formatMoney,
  STATUS_LABEL,
  STATUS_TONE,
} from "@/lib/format";
import { useCan, useMe } from "@/lib/hooks";
import type { Dashboard, OrderStatus } from "@/lib/types";
import { Badge, Card, ErrorBox, PageHeader } from "@/components/ui";

const today = new Intl.DateTimeFormat("ro-RO", { weekday: "long", day: "numeric", month: "long" });

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600";

// ---------- KPI ----------

type KpiTone = "neutral" | "warning" | "danger";

const KPI_ICON: Record<KpiTone, string> = {
  neutral: "bg-slate-100 text-slate-600",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-red-50 text-red-600",
};

function Kpi({
  icon: Icon,
  label,
  value,
  unit,
  hint,
  href,
  tone = "neutral",
  className = "",
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  unit?: string;
  hint: string;
  href?: string;
  tone?: KpiTone;
  className?: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-medium text-slate-500">{label}</span>
        <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${KPI_ICON[tone]}`}>
          <Icon className="size-4.5" aria-hidden />
        </span>
      </div>
      <div className="mt-2 font-mono text-2xl font-semibold tracking-tight tabular">
        {value}
        {unit && <span className="ml-1 text-sm font-medium text-slate-400">{unit}</span>}
      </div>
      <div className="mt-1 text-xs text-slate-500">
        {hint}
        {href && (
          <ArrowRight
            className="ml-1 inline-block size-3.5 align-[-3px] motion-safe:transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        )}
      </div>
    </>
  );
  const base = `group block rounded-xl border border-slate-200 bg-white p-4 ${className}`;
  return href ? (
    <Link href={href} className={`${base} hover:border-slate-300 motion-safe:transition-colors ${FOCUS}`}>
      {body}
    </Link>
  ) : (
    <div className={base}>{body}</div>
  );
}

// ---------- Grafic vânzări ----------

/** Rotunjește maximul axei în sus la o cifră „curată” (ex. 58.784 → 60.000), ca graficul să nu rămână turtit. */
function niceMax(value: number) {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((s) => s * magnitude >= value)!;
  return step * magnitude;
}

function RevenueChart({ data }: { data: Dashboard["revenueByDay"] }) {
  const max = niceMax(Math.max(...data.map((d) => d.total)));
  const n = data.length;
  // Fiecare punct stă în centrul coloanei lui, ca linia să se alinieze cu zonele de hover.
  const x = (i: number) => ((i + 0.5) / n) * 100;
  const y = (v: number) => 100 - (v / max) * 100;
  const line = data.map((d, i) => `${i ? "L" : "M"}${x(i)},${y(d.total)}`).join(" ");
  const area = `${line} L${x(n - 1)},100 L${x(0)},100 Z`;
  const ticks = [1, 0.5, 0];

  const total = data.reduce((sum, d) => sum + d.total, 0);
  const orders = data.reduce((sum, d) => sum + d.orders, 0);
  const best = data.reduce((a, b) => (b.total > a.total ? b : a));

  return (
    <div className="p-4">
      <dl className="grid grid-cols-2 gap-3 border-b border-slate-100 pb-4 sm:grid-cols-3">
        <Stat label="Total 14 zile" value={formatAmount(total)} unit="RON" className="col-span-2 sm:col-span-1" />
        <Stat label="Comenzi" value={orders} />
        <Stat label="Cea mai bună zi" value={best.total ? formatDay(best.date) : "—"} />
      </dl>

      <div className="relative mt-5 h-52 pl-10">
        {/* Grilă și etichete pe axa Y */}
        {ticks.map((t) => (
          <div key={t} className="absolute inset-x-0 flex items-center" style={{ bottom: `${t * 100}%` }}>
            <span className="w-10 -translate-y-px pr-2 text-right font-mono text-[11px] text-slate-400 tabular">
              {formatCompact(max * t)}
            </span>
            <span className="h-px flex-1 bg-slate-100" />
          </div>
        ))}

        <div className="absolute inset-y-0 right-0 left-10">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" aria-hidden>
            <path d={area} className="fill-brand-500/15" />
            <path
              d={line}
              className="fill-none stroke-brand-600"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {/* Zone de hover/focus: fiecare zi e accesibilă și de la tastatură */}
          <div className="absolute inset-0 flex">
            {data.map((d, i) => {
              const align = i < 2 ? "left-0" : i > n - 3 ? "right-0" : "left-1/2 -translate-x-1/2";
              const pct = (d.total / max) * 100;
              // Tooltip-ul stă lângă punct: dedesubt când punctul e sus, deasupra când e jos.
              const tipPosition = pct > 55 ? { top: `calc(${100 - pct}% + 12px)` } : { bottom: `calc(${pct}% + 12px)` };
              return (
                <button
                  key={d.date}
                  type="button"
                  aria-label={`${formatDay(d.date)}: ${formatMoney(d.total)}, ${d.orders} comenzi`}
                  className="group relative h-full flex-1 cursor-default focus-visible:outline-none"
                >
                  <span className="absolute inset-y-0 left-1/2 w-px bg-slate-300 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" />
                  <span
                    className="absolute left-1/2 size-2.5 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-white bg-brand-600 opacity-0 ring-1 ring-brand-600 group-hover:opacity-100 group-focus-visible:opacity-100"
                    style={{ bottom: `${pct}%` }}
                  />
                  <span
                    style={tipPosition}
                    className={`pointer-events-none absolute z-10 hidden rounded-lg bg-slate-900 px-2.5 py-1.5 text-left text-xs whitespace-nowrap text-white group-hover:block group-focus-visible:block ${align}`}
                  >
                    <span className="block text-slate-300">{formatDay(d.date)}</span>
                    <span className="block font-mono font-medium tabular">{formatMoney(d.total)}</span>
                    <span className="block text-slate-300">{d.orders} comenzi</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-2 flex justify-between pl-10 text-xs text-slate-400">
        <span>{formatDay(data[0]!.date)}</span>
        <span>{formatDay(data[Math.floor(n / 2)]!.date)}</span>
        <span>azi</span>
      </div>

      <details className="mt-4 text-sm">
        <summary className="cursor-pointer text-slate-500 hover:text-slate-900">Vezi datele ca tabel</summary>
        <table className="mt-2 w-full text-left">
          <thead className="text-xs text-slate-500">
            <tr>
              <th className="py-1 font-medium">Zi</th>
              <th className="py-1 text-right font-medium">Comenzi</th>
              <th className="py-1 text-right font-medium">Vânzări</th>
            </tr>
          </thead>
          <tbody className="font-mono tabular">
            {data.map((d) => (
              <tr key={d.date} className="border-t border-slate-100">
                <td className="py-1 font-sans">{formatDay(d.date)}</td>
                <td className="py-1 text-right">{d.orders}</td>
                <td className="py-1 text-right">{formatMoney(d.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

function Stat({ label, value, unit, className = "" }: { label: string; value: ReactNode; unit?: string; className?: string }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <dt className="truncate text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 truncate font-mono text-sm font-semibold tabular sm:text-base">
        {value}
        {unit && <span className="ml-1 text-xs font-medium text-slate-400">{unit}</span>}
      </dd>
    </div>
  );
}

// ---------- Comenzi pe status ----------

const PIPELINE: { status: OrderStatus; color: string }[] = [
  { status: "PENDING", color: "bg-amber-400" },
  { status: "CONFIRMED", color: "bg-sky-500" },
  { status: "SHIPPED", color: "bg-indigo-500" },
  { status: "DELIVERED", color: "bg-brand-500" },
  { status: "CANCELLED", color: "bg-slate-300" },
];

function StatusBreakdown({ counts }: { counts: Dashboard["ordersByStatus"] }) {
  const total = PIPELINE.reduce((sum, p) => sum + (counts[p.status] ?? 0), 0);
  return (
    <div className="p-4">
      <div className="font-mono text-2xl font-semibold tabular">
        {total}
        <span className="ml-1.5 font-sans text-sm font-medium text-slate-500">comenzi în total</span>
      </div>
      <div className="mt-4 flex h-3 gap-0.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
        {PIPELINE.map(({ status, color }) => {
          const count = counts[status] ?? 0;
          return count ? <span key={status} className={color} style={{ width: `${(count / total) * 100}%` }} /> : null;
        })}
      </div>
      <ul className="mt-4 space-y-1">
        {PIPELINE.map(({ status, color }) => {
          const count = counts[status] ?? 0;
          return (
            <li key={status}>
              <Link
                href={`/comenzi?status=${status}`}
                className={`flex h-10 items-center gap-3 rounded-lg px-2 text-sm hover:bg-slate-50 ${FOCUS}`}
              >
                <span aria-hidden className={`size-2.5 rounded-full ${color}`} />
                <span className="flex-1">{STATUS_LABEL[status]}</span>
                <span className="font-mono font-medium tabular">{count}</span>
                <span className="w-10 text-right font-mono text-xs text-slate-400 tabular">
                  {total ? Math.round((count / total) * 100) : 0}%
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------- Pagina ----------

function CardLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={`-mx-2 inline-flex h-10 items-center gap-1 rounded-md px-2 text-sm font-medium text-brand-700 hover:bg-brand-50 ${FOCUS}`}>
      {children}
      <ArrowRight className="size-3.5" aria-hidden />
    </Link>
  );
}

function Skeleton() {
  const block = "rounded-xl border border-slate-200 bg-white motion-safe:animate-pulse";
  return (
    <div className="space-y-6" aria-busy aria-label="Se încarcă panoul">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`h-[124px] ${block} ${i === 0 || i === 3 ? "col-span-2 sm:col-span-1" : ""}`} />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className={`h-[420px] lg:col-span-2 ${block}`} />
        <div className={`h-[420px] ${block}`} />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: me } = useMe();
  const canCreateOrder = useCan("orders:create");
  const canReceiveStock = useCan("stock:write");
  const { data, error } = useQuery({ queryKey: ["dashboard"], queryFn: () => api<Dashboard>("/dashboard") });

  const pending = data?.ordersByStatus.PENDING ?? 0;
  const toShip = data?.ordersByStatus.CONFIRMED ?? 0;
  const alerts = data?.openAlerts.count ?? 0;

  return (
    <>
      <PageHeader
        title={me ? `Bună, ${me.user.name.split(" ")[0]}` : "Panou"}
        // Data se afișează abia în browser, ca serverul (alt fus orar) să nu genereze alt text.
        subtitle={data ? `${today.format(new Date())} · situația comenzilor și a stocului` : "Situația comenzilor și a stocului"}
        action={
          canCreateOrder && (
            <Link
              href="/comenzi/noua"
              className={`inline-flex h-10 items-center gap-1.5 rounded-lg bg-slate-800 px-4 text-sm font-medium text-white hover:bg-slate-700 motion-safe:transition-colors ${FOCUS}`}
            >
              <Plus className="size-4" aria-hidden />
              Comandă nouă
            </Link>
          )
        }
      />
      <ErrorBox error={error} />
      {!data && !error && <Skeleton />}
      {data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Kpi
              icon={Banknote}
              label="Vânzări 30 de zile"
              value={formatAmount(data.revenue30d.total)}
              unit="RON"
              hint={`${data.revenue30d.orders} comenzi confirmate`}
              className="col-span-2 sm:col-span-1"
            />
            <Kpi
              icon={Hourglass}
              label="De confirmat"
              value={pending}
              hint={pending ? "așteaptă aprobare" : "nimic în așteptare"}
              href="/comenzi?status=PENDING"
              tone={pending ? "warning" : "neutral"}
            />
            <Kpi
              icon={Truck}
              label="De expediat"
              value={toShip}
              hint={toShip ? "confirmate, neexpediate" : "nimic de expediat"}
              href="/comenzi?status=CONFIRMED"
            />
            <Kpi
              icon={TriangleAlert}
              label="Alerte de stoc"
              value={alerts}
              hint={alerts ? "sub stocul minim" : "stoc în regulă"}
              href="/stoc"
              tone={alerts ? "danger" : "neutral"}
              className="col-span-2 sm:col-span-1"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-3 [&>*]:min-w-0">
            <Card title="Vânzări pe ultimele 14 zile" className="lg:col-span-2">
              <RevenueChart data={data.revenueByDay} />
            </Card>
            <Card title="Comenzi pe status">
              <StatusBreakdown counts={data.ordersByStatus} />
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3 [&>*]:min-w-0">
            <Card title="Comenzi recente" action={<CardLink href="/comenzi">Toate</CardLink>} className="lg:col-span-2">
              <ul className="divide-y divide-slate-100">
                {data.recentOrders.map((o) => (
                  <li key={o.id}>
                    <Link
                      href={`/comenzi/${o.id}`}
                      className={`flex min-h-14 items-center gap-3 px-4 py-2.5 hover:bg-slate-50 motion-safe:transition-colors ${FOCUS} focus-visible:-outline-offset-2`}
                    >
                      <span className="w-10 shrink-0 font-mono text-sm text-slate-400 tabular">#{o.id}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{o.customer.name}</span>
                        <span className="block text-xs text-slate-500">{formatDateTime(o.createdAt)}</span>
                      </span>
                      <span className="hidden font-mono text-sm tabular sm:block">{formatMoney(o.total)}</span>
                      <Badge tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>

            <Card
              title="Sub stocul minim"
              action={alerts > 0 && <Badge tone="danger">{alerts} {alerts === 1 ? "alertă" : "alerte"}</Badge>}
            >
              {data.openAlerts.items.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                  <span className="grid size-10 place-items-center rounded-full bg-brand-50 text-brand-700">
                    <PackageCheck className="size-5" aria-hidden />
                  </span>
                  <p className="text-sm text-slate-500">Toate produsele sunt peste stocul minim.</p>
                </div>
              ) : (
                <>
                  <ul className="divide-y divide-slate-100">
                    {data.openAlerts.items.map((a) => {
                      const ratio = Math.min(a.product.stock / Math.max(a.product.minStock, 1), 1);
                      return (
                        <li key={a.id} className="px-4 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <span className="min-w-0">
                              <span className="block text-sm leading-snug font-medium">{a.product.name}</span>
                              <span className="block font-mono text-xs text-slate-400">{a.product.sku}</span>
                            </span>
                            <span className="shrink-0 text-right font-mono text-sm tabular">
                              <span className="font-semibold text-red-600">{a.product.stock}</span>
                              <span className="text-slate-400"> / {a.product.minStock}</span>
                              <span className="block font-sans text-xs text-slate-500">{a.product.unit}</span>
                            </span>
                          </div>
                          <div
                            role="meter"
                            aria-label={`Stoc ${a.product.name}`}
                            aria-valuemin={0}
                            aria-valuemax={a.product.minStock}
                            aria-valuenow={a.product.stock}
                            className="mt-2 h-1.5 overflow-hidden rounded-full bg-red-50"
                          >
                            <div className="h-full rounded-full bg-red-500" style={{ width: `${ratio * 100}%` }} />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  {canReceiveStock && (
                    <div className="border-t border-slate-100 px-4 py-3">
                      <CardLink href="/stoc">Înregistrează o recepție</CardLink>
                    </div>
                  )}
                </>
              )}
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
