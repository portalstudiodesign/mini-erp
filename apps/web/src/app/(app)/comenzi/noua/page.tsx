"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import type { Customer, OrderDetail, Page, Product } from "@/lib/types";
import { Button, Card, ErrorBox, Field, Input, PageHeader, Select, Textarea } from "@/components/ui";

interface Line {
  key: number;
  productId: string;
  quantity: string;
}

let nextKey = 1;
const newLine = (): Line => ({ key: nextKey++, productId: "", quantity: "1" });

export default function NewOrderPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [customerId, setCustomerId] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([newLine()]);

  // Pentru volumul unui demo ajunge o listă completă; la mii de înregistrări aș folosi un câmp cu căutare.
  const customers = useQuery({
    queryKey: ["customers", "all"],
    queryFn: () => api<Page<Customer>>("/customers?pageSize=100"),
  });
  const products = useQuery({
    queryKey: ["products", "active"],
    queryFn: () => api<Page<Product>>("/products?active=true&pageSize=100"),
  });
  const productById = new Map(products.data?.items.map((p) => [p.id, p]));

  const create = useMutation({
    mutationFn: () =>
      api<OrderDetail>("/orders", {
        method: "POST",
        json: {
          customerId: Number(customerId),
          notes: notes || undefined,
          items: lines.filter((l) => l.productId).map((l) => ({ productId: Number(l.productId), quantity: Number(l.quantity) })),
        },
      }),
    onSuccess: (order) => {
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      router.push(`/comenzi/${order.id}`);
    },
  });

  const errors = create.error instanceof ApiError ? create.error.fieldErrors : {};
  const updateLine = (key: number, patch: Partial<Line>) => setLines(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  // Estimare afișată în UI; totalul real îl calculează serverul din prețurile curente.
  const estimate = lines.reduce((sum, l) => {
    const p = productById.get(Number(l.productId));
    return p ? sum + Number(p.price) * Number(l.quantity || 0) : sum;
  }, 0);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    create.mutate();
  }

  return (
    <>
      <PageHeader title="Comandă nouă" subtitle="Comanda se creează în așteptare; stocul se rezervă la confirmare." />
      <form onSubmit={onSubmit} className="space-y-6">
        <Card>
          <div className="grid gap-4 p-4 md:grid-cols-2">
            <Field label="Client" error={errors.customerId}>
              <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
                <option value="">Alege clientul…</option>
                {customers.data?.items.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.city ? ` · ${c.city}` : ""}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Observații" error={errors.notes}>
              <Textarea rows={1} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ex. livrare cu montaj" />
            </Field>
          </div>
        </Card>

        <Card title="Produse" action={<Button type="button" variant="secondary" onClick={() => setLines([...lines, newLine()])}>Adaugă rând</Button>}>
          <div className="divide-y divide-zinc-100">
            {lines.map((line, index) => {
              const product = productById.get(Number(line.productId));
              const overStock = product && Number(line.quantity) > product.stock;
              return (
                <div key={line.key} className="grid items-start gap-3 p-4 sm:grid-cols-[1fr_7rem_8rem_auto]">
                  <Field label={`Produs ${index + 1}`} error={errors[`items.${index}.productId`]}>
                    <Select value={line.productId} onChange={(e) => updateLine(line.key, { productId: e.target.value })}>
                      <option value="">Alege produsul…</option>
                      {products.data?.items.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.sku} · {p.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field
                    label="Cantitate"
                    error={errors[`items.${index}.quantity`]}
                    hint={product ? `${overStock ? "⚠ " : ""}stoc: ${product.stock} ${product.unit}` : undefined}
                  >
                    <Input type="number" min="1" value={line.quantity} onChange={(e) => updateLine(line.key, { quantity: e.target.value })} />
                  </Field>
                  <div className="space-y-1">
                    <span className="text-sm font-medium text-zinc-700">Valoare</span>
                    <div className="tabular py-2 text-sm">{product ? formatMoney(Number(product.price) * Number(line.quantity || 0)) : "—"}</div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    className="sm:mt-6"
                    disabled={lines.length === 1}
                    onClick={() => setLines(lines.filter((l) => l.key !== line.key))}
                    aria-label="Șterge rândul"
                  >
                    ✕
                  </Button>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between border-t border-zinc-200 bg-zinc-50/60 px-4 py-3">
            <span className="text-sm text-zinc-600">Total estimat (fără TVA)</span>
            <span className="tabular text-lg font-semibold">{formatMoney(estimate)}</span>
          </div>
        </Card>

        {errors.items && <ErrorBox error={new Error(errors.items)} />}
        {!Object.keys(errors).length && <ErrorBox error={create.error} />}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => router.back()}>
            Renunță
          </Button>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? "Se salvează…" : "Creează comanda"}
          </Button>
        </div>
      </form>
    </>
  );
}
