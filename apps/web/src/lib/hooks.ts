"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import type { Me, Permission } from "./types";

export function useMe() {
  return useQuery({ queryKey: ["me"], queryFn: () => api<Me>("/auth/me"), staleTime: 5 * 60_000, retry: false });
}

/** Ascunde în UI ce utilizatorul nu are voie să facă. Serverul verifică oricum. */
export function useCan(permission: Permission) {
  return useMe().data?.permissions.includes(permission) ?? false;
}

export function useDebounced<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
