"use client";

import { useState, type FormEvent } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, qs } from "@/lib/api";
import { useCan, useDebounced } from "@/lib/hooks";
import type { Customer, Page } from "@/lib/types";
import { Button, Card, EmptyRow, ErrorBox, Field, Input, Modal, PageHeader, Pagination, Table, Td, Th } from "@/components/ui";

function CustomerForm({ customer, onDone }: { customer?: Customer; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: customer?.name ?? "",
    taxId: customer?.taxId ?? "",
    email: customer?.email ?? "",
    phone: customer?.phone ?? "",
    city: customer?.city ?? "",
    address: customer?.address ?? "",
  });

  const save = useMutation({
    mutationFn: () =>
      customer
        ? api<Customer>(`/customers/${customer.id}`, { method: "PATCH", json: form })
        : api<Customer>("/customers", { method: "POST", json: form }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["customers"] });
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
      <Field label="Denumire / Nume" error={errors.name}>
        <Input value={form.name} onChange={set("name")} required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="CUI" error={errors.taxId} hint="Opțional; se verifică cifra de control">
          <Input value={form.taxId} onChange={set("taxId")} placeholder="RO12345678" />
        </Field>
        <Field label="Oraș" error={errors.city}>
          <Input value={form.city} onChange={set("city")} />
        </Field>
        <Field label="Email" error={errors.email}>
          <Input type="email" value={form.email} onChange={set("email")} />
        </Field>
        <Field label="Telefon" error={errors.phone}>
          <Input value={form.phone} onChange={set("phone")} />
        </Field>
      </div>
      <Field label="Adresă" error={errors.address}>
        <Input value={form.address} onChange={set("address")} />
      </Field>
      {!Object.keys(errors).length && <ErrorBox error={save.error} />}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onDone}>
          Renunță
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {customer ? "Salvează" : "Adaugă clientul"}
        </Button>
      </div>
    </form>
  );
}

export default function CustomersPage() {
  const canWrite = useCan("customers:write");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Customer | "new" | null>(null);
  const search = useDebounced(q);

  const { data, error } = useQuery({
    queryKey: ["customers", { search, page }],
    queryFn: () => api<Page<Customer>>(`/customers${qs({ q: search, page, pageSize: 15 })}`),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader
        title="Clienți"
        subtitle="Firme și persoane fizice"
        action={canWrite && <Button onClick={() => setEditing("new")}>Client nou</Button>}
      />
      <Card>
        <div className="border-b border-slate-100 p-4">
          <Input
            placeholder="Caută după nume, CUI sau email…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            className="max-w-xs"
          />
        </div>
        <ErrorBox error={error} />
        <Table>
          <thead>
            <tr>
              <Th>Nume</Th>
              <Th>CUI</Th>
              <Th>Oraș</Th>
              <Th>Contact</Th>
              <Th className="text-right">Comenzi</Th>
            </tr>
          </thead>
          <tbody>
            {data?.items.length === 0 && <EmptyRow colSpan={5}>Niciun client găsit.</EmptyRow>}
            {data?.items.map((c) => (
              <tr key={c.id} onClick={() => canWrite && setEditing(c)} className={canWrite ? "cursor-pointer hover:bg-slate-50" : undefined}>
                <Td className="font-medium">{c.name}</Td>
                <Td className="font-mono text-xs text-slate-600">{c.taxId ?? "—"}</Td>
                <Td>{c.city ?? "—"}</Td>
                <Td className="text-slate-600">{c.email ?? c.phone ?? "—"}</Td>
                <Td className="tabular text-right">{c._count?.orders ?? 0}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
        {data && <Pagination page={data.page} pageCount={data.pageCount} total={data.total} onPage={setPage} />}
      </Card>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Client nou" : "Editează clientul"}>
        <CustomerForm customer={editing === "new" || editing === null ? undefined : editing} onDone={() => setEditing(null)} />
      </Modal>
    </>
  );
}
