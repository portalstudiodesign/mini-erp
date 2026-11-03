"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatDateTime, formatMoney, MOVEMENT_LABEL, STATUS_LABEL, STATUS_TONE, TRANSITION_LABEL } from "@/lib/format";
import type { OrderDetail, OrderStatus } from "@/lib/types";
import { Badge, Button, Card, ErrorBox, PageHeader, Table, Td, Th } from "@/components/ui";

export default function OrderPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { data: order, error } = useQuery({ queryKey: ["order", id], queryFn: () => api<OrderDetail>(`/orders/${id}`) });

  const changeStatus = useMutation({
    mutationFn: (status: OrderStatus) => api<OrderDetail>(`/orders/${id}/status`, { method: "POST", json: { status } }),
    onSuccess: (updated) => {
      queryClient.setQueryData(["order", id], updated);
      // Stocul și listele s-au schimbat și ele.
      for (const key of ["orders", "products", "dashboard", "stock"]) void queryClient.invalidateQueries({ queryKey: [key] });
    },
  });

  function onTransition(status: OrderStatus) {
    if (status === "CANCELLED" && !window.confirm("Sigur anulezi comanda?")) return;
    changeStatus.mutate(status);
  }

  if (error) return <ErrorBox error={error} />;
  if (!order) return <p className="text-sm text-zinc-500">Se încarcă…</p>;

  return (
    <>
      <div className="mb-2 text-sm">
        <Link href="/comenzi" className="text-zinc-500 hover:text-zinc-800">
          ← Comenzi
        </Link>
      </div>
      <PageHeader
        title={`Comanda #${order.id}`}
        subtitle={`Creată de ${order.createdBy.name}, ${formatDateTime(order.createdAt)}`}
        action={<Badge tone={STATUS_TONE[order.status]}>{STATUS_LABEL[order.status]}</Badge>}
      />

      {order.allowedTransitions.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 bg-white p-3">
          <span className="mr-2 text-sm text-zinc-600">Acțiuni:</span>
          {order.allowedTransitions.map((status) => (
            <Button
              key={status}
              variant={status === "CANCELLED" ? "danger" : "primary"}
              disabled={changeStatus.isPending}
              onClick={() => onTransition(status)}
            >
              {TRANSITION_LABEL[status]}
            </Button>
          ))}
        </div>
      )}
      <div className="mb-6">
        <ErrorBox error={changeStatus.error} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_18rem] [&>*]:min-w-0">
        <Card title="Produse">
          <Table>
            <thead>
              <tr>
                <Th>Produs</Th>
                <Th className="text-right">Cantitate</Th>
                <Th className="text-right">Preț unitar</Th>
                <Th className="text-right">Valoare</Th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id}>
                  <Td>
                    <div className="font-medium">{item.product.name}</div>
                    <div className="font-mono text-xs text-zinc-500">
                      {item.product.sku} · în stoc: {item.product.stock} {item.product.unit}
                    </div>
                  </Td>
                  <Td className="tabular text-right">
                    {item.quantity} {item.product.unit}
                  </Td>
                  <Td className="tabular text-right">{formatMoney(item.unitPrice)}</Td>
                  <Td className="tabular text-right">{formatMoney(item.lineTotal)}</Td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className="px-4 py-3 text-right text-sm text-zinc-600">
                  Total (fără TVA)
                </td>
                <td className="tabular px-4 py-3 text-right text-base font-semibold">{formatMoney(order.total)}</td>
              </tr>
            </tfoot>
          </Table>
        </Card>

        <div className="space-y-6">
          <Card title="Client">
            <dl className="space-y-1 p-4 text-sm">
              <dt className="font-medium">{order.customer.name}</dt>
              {order.customer.taxId && <dd className="font-mono text-xs text-zinc-500">{order.customer.taxId}</dd>}
              {order.customer.city && <dd className="text-zinc-600">{order.customer.city}</dd>}
              {order.customer.email && <dd className="text-zinc-600">{order.customer.email}</dd>}
              {order.customer.phone && <dd className="text-zinc-600">{order.customer.phone}</dd>}
            </dl>
          </Card>
          {order.notes && (
            <Card title="Observații">
              <p className="p-4 text-sm text-zinc-700">{order.notes}</p>
            </Card>
          )}
          <Card title="Mișcări de stoc">
            {order.movements.length === 0 ? (
              <p className="p-4 text-sm text-zinc-500">Stocul nu a fost atins. Se rezervă la confirmare.</p>
            ) : (
              <ul className="divide-y divide-zinc-100 text-sm">
                {order.movements.map((m) => (
                  <li key={m.id} className="flex justify-between gap-2 px-4 py-2">
                    <span>
                      {MOVEMENT_LABEL[m.type]} <span className="text-zinc-500">· {m.user.name}</span>
                    </span>
                    <span className={`tabular ${m.quantity < 0 ? "text-red-600" : "text-emerald-700"}`}>
                      {m.quantity > 0 ? "+" : ""}
                      {m.quantity}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
