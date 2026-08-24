"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

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

type ContextValue = { settings: WidgetSettings; loaded: boolean };

const WidgetSettingsContext = createContext<ContextValue>({ settings: DEFAULT_SETTINGS, loaded: false });

// Every product card (and several other storefront widgets) used to call
// this hook and fetch independently — on a page with dozens of cards that
// meant dozens of identical, un-deduped requests to the same endpoint on
// every load. One provider now fetches once and every caller just reads
// from context, with the exact same {settings, loaded} shape as before so
// no call site had to change.
export function WidgetSettingsProvider({ children }: { children: ReactNode }) {
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

  return <WidgetSettingsContext.Provider value={{ settings, loaded }}>{children}</WidgetSettingsContext.Provider>;
}

export function useWidgetSettings() {
  return useContext(WidgetSettingsContext);
}
