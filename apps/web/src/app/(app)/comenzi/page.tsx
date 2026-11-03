"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api, qs } from "@/lib/api";
import { formatDateTime, formatMoney, STATUS_LABEL, STATUS_TONE } from "@/lib/format";
import { useCan, useDebounced } from "@/lib/hooks";
import type { OrderStatus, OrderSummary, Page } from "@/lib/types";
import { Badge, Button, Card, EmptyRow, ErrorBox, Input, PageHeader, Pagination, Table, Td, Th } from "@/components/ui";

const TABS: (OrderStatus | "ALL")[] = ["ALL", "PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"];

function Orders() {
  const router = useRouter();
  const params = useSearchParams();
  const canCreate = useCan("orders:create");
  const status = (params.get("status") as OrderStatus | null) ?? undefined;
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const search = useDebounced(q);

  const { data, error } = useQuery({
    queryKey: ["orders", { status, search, page }],
    queryFn: () => api<Page<OrderSummary>>(`/orders${qs({ status, q: search, page, pageSize: 15 })}`),
    placeholderData: keepPreviousData,
  });

  function selectTab(tab: OrderStatus | "ALL") {
    setPage(1);
    router.replace(tab === "ALL" ? "/comenzi" : `/comenzi?status=${tab}`);
  }

  return (
    <>
      <PageHeader
        title="Comenzi"
        action={
          canCreate && (
            <Link href="/comenzi/noua">
              <Button>Comandă nouă</Button>
            </Link>
          )
        }
      />
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-zinc-100 p-4">
          <div className="flex flex-wrap gap-1">
            {TABS.map((tab) => {
              const active = (tab === "ALL" && !status) || tab === status;
              return (
                <button
                  key={tab}
                  onClick={() => selectTab(tab)}
                  className={`rounded-md px-3 py-1.5 text-sm ${active ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"}`}
                >
                  {tab === "ALL" ? "Toate" : STATUS_LABEL[tab]}
                </button>
              );
            })}
          </div>
          <Input
            placeholder="Nr. comandă sau client…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            className="ml-auto max-w-56"
          />
        </div>
        <ErrorBox error={error} />
        <Table>
          <thead>
            <tr>
              <Th>Nr.</Th>
              <Th>Client</Th>
              <Th>Data</Th>
              <Th className="text-right">Produse</Th>
              <Th className="text-right">Total</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {data?.items.length === 0 && <EmptyRow colSpan={6}>Nicio comandă.</EmptyRow>}
            {data?.items.map((o) => (
              <tr key={o.id} onClick={() => router.push(`/comenzi/${o.id}`)} className="cursor-pointer hover:bg-zinc-50">
                <Td className="tabular text-zinc-500">#{o.id}</Td>
                <Td className="font-medium">{o.customer.name}</Td>
                <Td className="whitespace-nowrap text-zinc-600">{formatDateTime(o.createdAt)}</Td>
                <Td className="tabular text-right">{o._count?.items}</Td>
                <Td className="tabular whitespace-nowrap text-right">{formatMoney(o.total)}</Td>
                <Td>
                  <Badge tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</Badge>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
        {data && <Pagination page={data.page} pageCount={data.pageCount} total={data.total} onPage={setPage} />}
      </Card>
    </>
  );
}

export default function OrdersPage() {
  return (
    <Suspense>
      <Orders />
    </Suspense>
  );
}
