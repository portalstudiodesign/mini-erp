"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Me } from "@/lib/types";
import { Button, ErrorBox, Field, Input } from "@/components/ui";

const DEMO_ACCOUNTS = [
  { email: "admin@demo.ro", label: "Administrator" },
  { email: "vanzari@demo.ro", label: "Vânzări" },
  { email: "depozit@demo.ro", label: "Depozit" },
];

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);

  async function login(credentials: { email: string; password: string }) {
    setPending(true);
    setError(null);
    try {
      const me = await api<Me>("/auth/login", { method: "POST", json: credentials });
      queryClient.setQueryData(["me"], me);
      const next = params.get("next");
      router.replace(next?.startsWith("/") && !next.startsWith("//") ? next : "/");
    } catch (err) {
      setError(err);
      setPending(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void login({ email, password });
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 grid size-10 place-items-center rounded-lg bg-brand-600 text-lg font-bold text-white">M</div>
        <h1 className="text-xl font-semibold">Mini ERP</h1>
        <p className="mt-1 text-sm text-zinc-500">Comenzi, stocuri și clienți</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-xs">
        <Field label="Email">
          <Input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Parolă">
          <Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <ErrorBox error={error} />
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Se conectează…" : "Intră în cont"}
        </Button>
      </form>

      <div className="mt-6 rounded-lg border border-dashed border-zinc-300 p-4">
        <p className="mb-3 text-xs text-zinc-500">Conturi demo (parola Demo1234!). Fiecare rol vede alte acțiuni:</p>
        <div className="grid grid-cols-3 gap-2">
          {DEMO_ACCOUNTS.map((a) => (
            <Button key={a.email} variant="secondary" disabled={pending} onClick={() => void login({ email: a.email, password: "Demo1234!" })}>
              {a.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
