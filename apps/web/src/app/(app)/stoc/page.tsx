"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, qs } from "@/lib/api";
import { formatDateTime, MOVEMENT_LABEL } from "@/lib/format";
import { useCan, useDebounced } from "@/lib/hooks";
import type { MovementType, Page, Product, StockAlert, StockMovement } from "@/lib/types";
import { Badge, Button, Card, EmptyRow, ErrorBox, Field, Input, PageHeader, Pagination, Select, Table, Td, Th } from "@/components/ui";

const MOVEMENT_TONE: Record<MovementType, "success" | "info" | "warning" | "neutral"> = {
  RECEIPT: "success",
  SALE: "info",
  RETURN: "warning",
  ADJUSTMENT: "neutral",
};

function MovementForm() {
  const queryClient = useQueryClient();
  const [type, setType] = useState<"RECEIPT" | "ADJUSTMENT">("RECEIPT");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");

  const products = useQuery({
    queryKey: ["products", "all"],
    queryFn: () => api<Page<Product>>("/products?pageSize=100"),
  });

  const save = useMutation({
    mutationFn: () =>
      api<StockMovement>("/stock/movements", {
        method: "POST",
        json: { type, productId: Number(productId), quantity: Number(quantity), reason: reason || undefined },
      }),
    onSuccess: () => {
      setQuantity("");
      setReason("");
      for (const key of ["stock", "products", "dashboard"]) void queryClient.invalidateQueries({ queryKey: [key] });
    },
  });

  const errors = save.error instanceof ApiError ? save.error.fieldErrors : {};
  const selected = products.data?.items.find((p) => p.id === Number(productId));

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }

  return (
    <Card title="Mișcare nouă">
      <form onSubmit={onSubmit} className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-1 rounded-md bg-zinc-100 p-1">
          {(["RECEIPT", "ADJUSTMENT"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`rounded px-3 py-1.5 text-sm ${type === t ? "bg-white font-medium shadow-xs" : "text-zinc-600"}`}
            >
              {MOVEMENT_LABEL[t]}
            </button>
          ))}
        </div>
        <Field label="Produs" error={errors.productId}>
          <Select value={productId} onChange={(e) => setProductId(e.target.value)} required>
            <option value="">Alege produsul…</option>
            {products.data?.items.map((p) => (
              <option key={p.id} value={p.id}>
                {p.sku} · {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label={type === "RECEIPT" ? "Cantitate primită" : "Diferență (+ sau −)"}
          error={errors.quantity}
          hint={selected ? `Stoc curent: ${selected.stock} ${selected.unit}` : undefined}
        >
          <Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
        </Field>
        <Field label={type === "RECEIPT" ? "Document / furnizor (opțional)" : "Motiv"} error={errors.reason}>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={type === "RECEIPT" ? "NIR 1024" : "Inventar lunar"} />
        </Field>
        {!Object.keys(errors).length && <ErrorBox error={save.error} />}
        {save.isSuccess && <p className="text-sm text-emerald-700">Mișcare înregistrată.</p>}
        <Button type="submit" disabled={save.isPending} className="w-full">
          Înregistrează
        </Button>
      </form>
    </Card>
  );
}

export default function StockPage() {
  const canWrite = useCan("stock:write");
  const [q, setQ] = useState("");
  const [type, setType] = useState<MovementType | "">("");
  const [page, setPage] = useState(1);
  const search = useDebounced(q);

  const alerts = useQuery({ queryKey: ["stock", "alerts"], queryFn: () => api<StockAlert[]>("/stock/alerts") });
  const movements = useQuery({
    queryKey: ["stock", "movements", { search, type, page }],
    queryFn: () => api<Page<StockMovement>>(`/stock/movements${qs({ q: search, type, page, pageSize: 15 })}`),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader title="Stoc" subtitle="Jurnalul mișcărilor și alertele de stoc minim" />

      {alerts.data && alerts.data.length > 0 && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h2 className="mb-2 text-sm font-semibold text-amber-900">{alerts.data.length} produse sub stocul minim</h2>
          <ul className="space-y-1 text-sm text-amber-900">
            {alerts.data.map((a) => (
              <li key={a.id}>
                <span className="font-mono text-xs">{a.product.sku}</span> {a.product.name}:{" "}
                <strong>
                  {a.product.stock} {a.product.unit}
                </strong>{" "}
                (minim {a.product.minStock})
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={`grid gap-6 [&>*]:min-w-0 ${canWrite ? "lg:grid-cols-[1fr_20rem]" : ""}`}>
        <Card>
          <div className="flex flex-wrap gap-3 border-b border-zinc-100 p-4">
            <Input
              placeholder="Produs sau SKU…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              className="max-w-56"
            />
            <Select
              value={type}
              onChange={(e) => {
                setType(e.target.value as MovementType | "");
                setPage(1);
              }}
              className="max-w-40"
            >
              <option value="">Toate tipurile</option>
              {(Object.keys(MOVEMENT_LABEL) as MovementType[]).map((t) => (
                <option key={t} value={t}>
                  {MOVEMENT_LABEL[t]}
                </option>
              ))}
            </Select>
          </div>
          <ErrorBox error={movements.error} />
          <Table>
            <thead>
              <tr>
                <Th>Data</Th>
                <Th>Produs</Th>
                <Th>Tip</Th>
                <Th className="text-right">Cantitate</Th>
                <Th>Detalii</Th>
              </tr>
            </thead>
            <tbody>
              {movements.data?.items.length === 0 && <EmptyRow colSpan={5}>Nicio mișcare.</EmptyRow>}
              {movements.data?.items.map((m) => (
                <tr key={m.id}>
                  <Td className="whitespace-nowrap text-zinc-600">{formatDateTime(m.createdAt)}</Td>
                  <Td>
                    <div className="font-medium">{m.product?.name}</div>
                    <div className="font-mono text-xs text-zinc-500">{m.product?.sku}</div>
                  </Td>
                  <Td>
                    <Badge tone={MOVEMENT_TONE[m.type]}>{MOVEMENT_LABEL[m.type]}</Badge>
                  </Td>
                  <Td className={`tabular text-right font-medium ${m.quantity < 0 ? "text-red-600" : "text-emerald-700"}`}>
                    {m.quantity > 0 ? "+" : ""}
                    {m.quantity}
                  </Td>
                  <Td className="text-zinc-600">
                    {m.orderId ? (
                      <Link href={`/comenzi/${m.orderId}`} className="text-brand-700 hover:underline">
                        Comanda #{m.orderId}
                      </Link>
                    ) : (
                      m.reason ?? "—"
                    )}
                    <div className="text-xs text-zinc-400">{m.user.name}</div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          {movements.data && (
            <Pagination page={movements.data.page} pageCount={movements.data.pageCount} total={movements.data.total} onPage={setPage} />
          )}
        </Card>
        {canWrite && (
          <div>
            <MovementForm />
          </div>
        )}
      </div>
    </>
  );
}
