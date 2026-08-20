"use client";

import { useEffect, useState } from "react";

export type WidgetKey =
  | "milestone_bar"
  | "deal_of_day"
  | "tiered_box"
  | "promotion_card"
  | "promotion_badge"
  | "cart_drawer_offer"
  | "popup"
  | "floating_button"
  | "congrats_bar"
  | "gifts_on_slide_cart";

export type WidgetSettings = Record<WidgetKey, { enabled: boolean; config: Record<string, unknown> }>;

const DEFAULT_SETTINGS: WidgetSettings = {
  milestone_bar: { enabled: true, config: {} },
  deal_of_day: { enabled: false, config: {} },
  tiered_box: { enabled: false, config: {} },
  promotion_card: { enabled: false, config: {} },
  promotion_badge: { enabled: false, config: {} },
  cart_drawer_offer: { enabled: false, config: {} },
  popup: { enabled: false, config: {} },
  floating_button: { enabled: false, config: {} },
  congrats_bar: { enabled: false, config: {} },
  gifts_on_slide_cart: { enabled: false, config: {} },
};

// Fetched once per page load — mirrors the fetch("/api/wishlist")/
// fetch("/api/free-gifts") pattern already used in cart-context.tsx. Widgets
// default to DEFAULT_SETTINGS (only milestone_bar on) while loading so
// nothing flashes on before real settings arrive.
export function useWidgetSettings() {
  const [settings, setSettings] = useState<WidgetSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/free-gifts/widgets")
      .then((r) => r.json())
      .then((data) => {
        const rows: { key: WidgetKey; enabled: boolean; config: Record<string, unknown> }[] = Array.isArray(data?.widgets)
          ? data.widgets
          : [];
        if (rows.length === 0) return;
        const next = { ...DEFAULT_SETTINGS };
        for (const row of rows) {
          if (row.key in next) next[row.key] = { enabled: row.enabled, config: row.config ?? {} };
        }
        setSettings(next);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  return { settings, loaded };
}
