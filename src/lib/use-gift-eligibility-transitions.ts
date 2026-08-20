"use client";

import { useEffect, useRef, useState } from "react";
import { FreeGiftEval } from "@/data/free-gifts";

// Detects promos that just BECAME eligible this render (vs. were already
// eligible) — evaluateActiveFreeGifts itself is stateless/pure, so "newly
// eligible" has to be diffed against a ref of what was eligible last time.
// Shared by the Pop-up and Congrats bar widgets so the detection logic
// isn't duplicated (and so their precedence rule — popup suppresses the
// congrats bar for the same transition — can be coordinated by the caller).
export function useGiftEligibilityTransitions(evals: FreeGiftEval[]): FreeGiftEval[] {
  const prevEligible = useRef<Set<string>>(new Set());
  const [newlyEligible, setNewlyEligible] = useState<FreeGiftEval[]>([]);

  useEffect(() => {
    const currentEligible = evals.filter((e) => e.eligible);
    const currentSlugs = new Set(currentEligible.map((e) => e.promo.slug));
    const fresh = currentEligible.filter((e) => !prevEligible.current.has(e.promo.slug));
    prevEligible.current = currentSlugs;
    if (fresh.length > 0) setNewlyEligible(fresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(evals.map((e) => [e.promo.slug, e.eligible]))]);

  return newlyEligible;
}
