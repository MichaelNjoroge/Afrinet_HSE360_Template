import { createContext, useContext, useMemo, type ReactNode } from "react";

type EmployeeLike = Record<string, unknown>;

type EmployeeNamesContextValue = {
  names: Map<string, string>;
  resolve: (value: unknown) => string | null;
  format: (value: unknown) => unknown;
};

const EmployeeNamesContext = createContext<EmployeeNamesContextValue>({
  names: new Map(),
  resolve: () => null,
  format: (value) => value,
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export function EmployeeNamesProvider({
  employees,
  directory,
  children,
}: {
  employees: EmployeeLike[];
  directory?: Array<{ id: string; name: string }>;
  children: ReactNode;
}) {
  const value = useMemo<EmployeeNamesContextValue>(() => {
    const names = new Map<string, string>();
    for (const entry of directory ?? []) {
      if (entry && typeof entry.id === "string" && typeof entry.name === "string" && entry.name.trim()) {
        names.set(entry.id, entry.name);
      }
    }
    for (const row of employees) {
      const id = row?.id;
      const name = row?.full_name ?? row?.name;
      if (typeof id === "string" && typeof name === "string" && name.trim()) {
        names.set(id, name);
      }
      const userId = row?.user_id;
      if (typeof userId === "string" && typeof name === "string" && name.trim()) {
        names.set(userId, name);
      }
    }
    const resolve = (raw: unknown) => {
      if (isUuid(raw)) return names.get(raw) ?? null;
      if (typeof raw === "string" && raw.includes("@")) {
        // Fallback: show the local-part of the email in Title Case instead of the raw address.
        const local = raw.split("@")[0] ?? raw;
        return local
          .replace(/[._-]+/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase())
          .trim() || raw;
      }
      return null;
    };
    const format = (raw: unknown) => {
      const name = resolve(raw);
      return name ?? raw;
    };

    return { names, resolve, format };
  }, [employees, directory]);
  return (
    <EmployeeNamesContext.Provider value={value}>{children}</EmployeeNamesContext.Provider>
  );
}

export function useEmployeeNames() {
  return useContext(EmployeeNamesContext);
}
