"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { api } from "@/lib/api";
import { ROLE_LABEL } from "@/lib/format";
import { useMe } from "@/lib/hooks";
import type { Permission } from "@/lib/types";

const NAV: { href: string; label: string; permission?: Permission }[] = [
  { href: "/", label: "Panou" },
  { href: "/comenzi", label: "Comenzi", permission: "orders:read" },
  { href: "/produse", label: "Produse", permission: "products:read" },
  { href: "/clienti", label: "Clienți", permission: "customers:read" },
  { href: "/stoc", label: "Stoc", permission: "stock:read" },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: me } = useMe();

  const nav = NAV.filter((item) => !item.permission || me?.permissions.includes(item.permission));
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  async function logout() {
    await api("/auth/logout", { method: "POST" });
    queryClient.clear();
    router.replace("/login");
  }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="grid size-7 place-items-center rounded-md bg-brand-600 text-sm font-bold text-white">M</span>
            <span className="hidden sm:inline">Mini ERP</span>
          </Link>
          <nav className="-mx-1 flex min-w-0 flex-1 gap-1 overflow-x-auto">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ${
                  isActive(item.href) ? "bg-brand-50 text-brand-700" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          {me && (
            <div className="flex items-center gap-3">
              <div className="hidden text-right leading-tight md:block">
                <div className="text-sm font-medium">{me.user.name}</div>
                <div className="text-xs text-zinc-500">{ROLE_LABEL[me.user.role]}</div>
              </div>
              <button onClick={() => void logout()} className="rounded-md px-2 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100">
                Ieșire
              </button>
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
