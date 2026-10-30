"use client";

import { useCallback, useEffect, useState } from "react";

// The three things both address books do, which are the same three things.
//
// The shipping book and the tax book differ in their rows and their fields,
// not in how a list is reloaded, a default is moved or an entry is deleted —
// so that part lives here once and each card draws its own rows.

export function useAddressBook<T extends { id: string }>(api: string, enabled: boolean) {
  const [rows, setRows] = useState<T[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!enabled) {
      setRows([]);
      return;
    }
    fetch(api)
      .then((r) => r.json())
      .then((data) => setRows(data.addresses || []))
      .catch(() => setRows([]));
  }, [api, enabled]);

  useEffect(() => {
    load();
  }, [load]);

  async function setDefault(id: string) {
    setBusyId(id);
    await fetch(`${api}/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ is_default: true }),
    }).catch(() => {});
    setBusyId(null);
    load();
  }

  async function remove(id: string, confirmText: string) {
    if (!confirm(confirmText)) return;
    setBusyId(id);
    await fetch(`${api}/${id}`, { method: "DELETE" }).catch(() => {});
    setBusyId(null);
    load();
  }

  return { rows, busyId, load, setDefault, remove };
}
