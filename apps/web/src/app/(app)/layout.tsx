"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ClipboardList, LayoutDashboard, LogOut, Package, Users, Warehouse, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { api } from "@/lib/api";
import { ROLE_LABEL } from "@/lib/format";
import { useMe } from "@/lib/hooks";
import type { Permission } from "@/lib/types";
import { Logo } from "@/components/ui";

const NAV: { href: string; label: string; icon: LucideIcon; permission?: Permission }[] = [
  { href: "/", label: "Panou", icon: LayoutDashboard },
  { href: "/comenzi", label: "Comenzi", icon: ClipboardList, permission: "orders:read" },
  { href: "/produse", label: "Produse", icon: Package, permission: "products:read" },
  { href: "/clienti", label: "Clienți", icon: Users, permission: "customers:read" },
  { href: "/stoc", label: "Stoc", icon: Warehouse, permission: "stock:read" },
];

const initials = (name: string) =>
  name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

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

  const logoutButton = (
    <button
      onClick={() => void logout()}
      aria-label="Ieșire din cont"
      title="Ieșire"
      className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-brand-600 motion-safe:transition-colors"
    >
      <LogOut className="size-4.5" aria-hidden />
    </button>
  );

  return (
    <div className="min-h-dvh lg:pl-64">
      {/* Desktop: meniu lateral fix */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
        <Link href="/" className="flex h-16 items-center gap-3 border-b border-slate-100 px-5">
          <Logo className="size-9 text-base" />
          <span className="leading-tight">
            <span className="block font-semibold">Mini ERP</span>
            <span className="block text-xs text-slate-500">Porți decupate laser</span>
          </span>
        </Link>
        <nav aria-label="Navigare principală" className="flex-1 space-y-1 p-3">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium motion-safe:transition-colors ${
                  active ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                {active && <span aria-hidden className="absolute inset-y-2 left-0 w-1 rounded-r bg-brand-600" />}
                <Icon className={`size-4.5 ${active ? "text-brand-700" : "text-slate-400"}`} aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>
        {me && (
          <div className="flex items-center gap-3 border-t border-slate-100 p-3">
            <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
              {initials(me.user.name)}
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-sm font-medium">{me.user.name}</span>
              <span className="block text-xs text-slate-500">{ROLE_LABEL[me.user.role]}</span>
            </span>
            {logoutButton}
          </div>
        )}
      </aside>

      {/* Mobil și tabletă: antet cu meniu orizontal */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur lg:hidden">
        <div className="flex h-14 items-center gap-3 px-4">
          <Link href="/" className="flex h-11 items-center gap-2 font-semibold">
            <Logo className="size-8 text-sm" />
            Mini ERP
          </Link>
          <span className="flex-1" />
          {me && (
            <span className="min-w-0 truncate text-right text-xs leading-tight text-slate-500">
              <span className="block truncate font-medium text-slate-900">{me.user.name}</span>
              {ROLE_LABEL[me.user.role]}
            </span>
          )}
          {me && logoutButton}
        </div>
        <nav aria-label="Navigare principală" className="flex gap-1 overflow-x-auto px-2 pb-2 [scrollbar-width:none]">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium ${
                  active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
    </div>
  );
}
