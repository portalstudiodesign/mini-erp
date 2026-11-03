"use client";

import { useState, type FormEvent } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, qs } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { useCan, useDebounced } from "@/lib/hooks";
import type { Page, Product } from "@/lib/types";
import { Badge, Button, Card, EmptyRow, ErrorBox, Field, Input, Modal, PageHeader, Pagination, Table, Td, Th } from "@/components/ui";

function ProductForm({ product, onDone }: { product?: Product; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    sku: product?.sku ?? "",
    name: product?.name ?? "",
    unit: product?.unit ?? "buc",
    price: product?.price ?? "",
    minStock: String(product?.minStock ?? 0),
    active: product?.active ?? true,
  });

  const save = useMutation({
    mutationFn: () => {
      const body = { ...form, price: Number(form.price), minStock: Number(form.minStock) };
      return product
        ? api<Product>(`/products/${product.id}`, { method: "PATCH", json: body })
        : api<Product>("/products", { method: "POST", json: body });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      onDone();
    },
  });

  const errors = save.error instanceof ApiError ? save.error.fieldErrors : {};
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="SKU" error={errors.sku}>
          <Input value={form.sku} onChange={set("sku")} required />
        </Field>
        <Field label="Unitate" error={errors.unit}>
          <Input value={form.unit} onChange={set("unit")} required />
        </Field>
      </div>
      <Field label="Denumire" error={errors.name}>
        <Input value={form.name} onChange={set("name")} required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Preț (RON, fără TVA)" error={errors.price}>
          <Input type="number" step="0.01" min="0" value={form.price} onChange={set("price")} required />
        </Field>
        <Field label="Stoc minim" error={errors.minStock} hint="Sub acest prag apare o alertă">
          <Input type="number" min="0" value={form.minStock} onChange={set("minStock")} required />
        </Field>
      </div>
      {product && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
          Activ (poate fi adăugat în comenzi)
        </label>
      )}
      <p className="text-xs text-slate-500">Stocul nu se editează aici: se modifică doar prin recepții și corecții, din pagina Stoc.</p>
      {!Object.keys(errors).length && <ErrorBox error={save.error} />}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onDone}>
          Renunță
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {product ? "Salvează" : "Adaugă produsul"}
        </Button>
      </div>
    </form>
  );
}

export default function ProductsPage() {
  const canWrite = useCan("products:write");
  const [q, setQ] = useState("");
  const [lowStock, setLowStock] = useState(false);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const search = useDebounced(q);

  const { data, error, isFetching } = useQuery({
    queryKey: ["products", { search, lowStock, page }],
    queryFn: () => api<Page<Product>>(`/products${qs({ q: search, lowStock, page, pageSize: 15 })}`),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader
        title="Produse"
        subtitle="Catalog și niveluri de stoc"
        action={canWrite && <Button onClick={() => setEditing("new")}>Produs nou</Button>}
      />
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
          <Input
            placeholder="Caută după denumire sau SKU…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            className="max-w-xs"
          />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={lowStock}
              onChange={(e) => {
                setLowStock(e.target.checked);
                setPage(1);
              }}
            />
            Doar sub stocul minim
          </label>
          {isFetching && <span className="text-xs text-slate-400">Se încarcă…</span>}
        </div>
        <ErrorBox error={error} />
        <Table>
          <thead>
            <tr>
              <Th>SKU</Th>
              <Th>Denumire</Th>
              <Th className="text-right">Preț</Th>
              <Th className="text-right">Stoc</Th>
              <Th className="text-right">Minim</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {data?.items.length === 0 && <EmptyRow colSpan={6}>Niciun produs găsit.</EmptyRow>}
            {data?.items.map((p) => {
              const low = p.stock < p.minStock;
              return (
                <tr
                  key={p.id}
                  onClick={() => canWrite && setEditing(p)}
                  className={canWrite ? "cursor-pointer hover:bg-slate-50" : undefined}
                >
                  <Td className="font-mono text-xs text-slate-600">{p.sku}</Td>
                  <Td className="font-medium">{p.name}</Td>
                  <Td className="tabular text-right">{formatMoney(p.price)}</Td>
                  <Td className={`tabular text-right ${low ? "font-semibold text-red-600" : ""}`}>
                    {p.stock} <span className="font-normal text-slate-400">{p.unit}</span>
                  </Td>
                  <Td className="tabular text-right text-slate-500">{p.minStock}</Td>
                  <Td>{p.active ? low ? <Badge tone="danger">Stoc mic</Badge> : <Badge tone="success">Activ</Badge> : <Badge>Inactiv</Badge>}</Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
        {data && <Pagination page={data.page} pageCount={data.pageCount} total={data.total} onPage={setPage} />}
      </Card>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Produs nou" : "Editează produsul"}>
        <ProductForm product={editing === "new" || editing === null ? undefined : editing} onDone={() => setEditing(null)} />
      </Modal>
    </>
  );
}
