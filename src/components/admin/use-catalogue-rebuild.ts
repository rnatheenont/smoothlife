"use client";

import { useCallback, useEffect, useState } from "react";

// "Pull everything from Shopify again", shared by the two screens that offer
// it: the product media card and the console's home page.
//
// What it actually asks for is a deployment. The cart, the search page, the
// chat's product chips and about twenty more client components import the
// generated catalogue straight into the browser bundle, and that file is
// written by scripts/fetch-products.js during a build — Vercel's filesystem is
// read-only at runtime, so there is no other way to change what they show.
//
// Which is why the server keeps a cooldown and this keeps the button honest
// about it: the plan allows 100 deployments a day, and spending them all
// leaves nothing to deploy a fix with for 24 hours.

const ENDPOINT = "/api/admin/product-content/rebuild";

export type CatalogueRebuild = {
  /** False when there is no deploy hook set, or this admin may not do it. */
  available: boolean;
  /** When the server will accept another request, or null when it will now. */
  readyAt: number | null;
  /** Local time of `readyAt`, ready to put in a label. */
  readyLabel: string;
  lastTriggeredAt: string | null;
  busy: boolean;
  note: string | null;
  trigger: () => Promise<void>;
};

function coolingUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const at = Date.parse(iso);
  return Number.isFinite(at) && at > Date.now() ? at : null;
}

export function useCatalogueRebuild(
  /** Which screen asked, for the record the server keeps. */
  reason: "product-images" | "product-content" | "overview" = "product-images",
): CatalogueRebuild {
  const [available, setAvailable] = useState(false);
  const [readyAt, setReadyAt] = useState<number | null>(null);
  const [lastTriggeredAt, setLastTriggeredAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    // A refusal here is the permission check as much as the config check:
    // the route is covered by product_content.manage, so an admin who may not
    // rebuild simply never sees the button.
    fetch(ENDPOINT)
      .then((r) => r.json())
      .then((d) => {
        if (!alive || !d?.ok) return;
        setAvailable(d.configured === true);
        setReadyAt(coolingUntil(d.readyAt));
        setLastTriggeredAt(
          typeof d.lastTriggeredAt === "string" ? d.lastTriggeredAt : null,
        );
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // The button re-enables itself when the wait is over, rather than reading
  // the clock while rendering and then staying stale until something else
  // happens to re-render it.
  useEffect(() => {
    if (readyAt === null) return;
    const id = setTimeout(
      () => setReadyAt(null),
      Math.max(0, readyAt - Date.now()),
    );
    return () => clearTimeout(id);
  }, [readyAt]);

  const trigger = useCallback(async () => {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json().catch(() => null);
      setNote(
        data?.ok
          ? "สั่งอัปเดตแล้ว — ใช้เวลาราว 3-5 นาที"
          : data?.error || "สั่งอัปเดตไม่สำเร็จ",
      );
      if (data?.ok) setLastTriggeredAt(data.triggeredAt ?? null);
      setReadyAt(coolingUntil(data?.readyAt));
    } catch {
      setNote("สั่งอัปเดตไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setBusy(false);
    }
  }, [reason]);

  return {
    available,
    readyAt,
    readyLabel:
      readyAt === null
        ? ""
        : new Date(readyAt).toLocaleTimeString("th-TH", {
            hour: "2-digit",
            minute: "2-digit",
          }),
    lastTriggeredAt,
    busy,
    note,
    trigger,
  };
}
