"use client";

import { useEffect, useState } from "react";
import type { ProductCardData } from "@/data/card";

// The products to suggest for a skin result, one short list per finding.
//
// The ranking is in lib/skin-recommend.ts and still is; it reads every
// product's classification against every concern, so it runs on the server
// now (POST /api/advisor, kind "skin"). Both places that show a scan — the
// result screen and a saved scan in the account — ask the same way, which
// also means the rule about not repeating a product across findings is
// applied once, in one place, instead of being rebuilt in each caller.

export type SkinPick = { card: ProductCardData; type: string; main: boolean };

export type SkinGroup = { picks: SkinPick[]; skipped: number };

export function useSkinPicks(
  concerns: readonly string[],
  skinTypes: readonly string[],
  /** Already bought, or otherwise not worth suggesting again. */
  exclude: readonly string[] = [],
  max = 3
): Record<string, SkinGroup> {
  const [byConcern, setByConcern] = useState<Record<string, SkinGroup>>({});
  // Strings, so a caller that rebuilds the same arrays every render does not
  // re-ask on every render.
  const key = JSON.stringify([concerns, skinTypes, [...exclude].sort(), max]);

  useEffect(() => {
    const [wanted, types, skip, limit] = JSON.parse(key) as [string[], string[], string[], number];
    if (wanted.length === 0) {
      setByConcern({});
      return;
    }
    let cancelled = false;
    fetch("/api/advisor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "skin", concerns: wanted, skinTypes: types, exclude: skip, max: limit }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !Array.isArray(data?.groups)) return;
        const next: Record<string, SkinGroup> = {};
        for (const g of data.groups as { concern: string; picks: SkinPick[]; skipped?: number }[]) {
          next[g.concern] = { picks: g.picks ?? [], skipped: g.skipped ?? 0 };
        }
        setByConcern(next);
      })
      // The findings still read; they simply come without a shelf.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [key]);

  return byConcern;
}
