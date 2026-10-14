import { NextRequest, NextResponse } from "next/server";
import { recommendOralCareSet } from "@/lib/oral-care";
import { recommendSupplementPlan } from "@/lib/supplement-advisor";
import { recommendFor } from "@/lib/skin-recommend";
import type { ConcernMetric } from "@/lib/skin-analysis";
import type { SkinTypeKey } from "@/lib/skin-coach";
import { toCardData } from "@/data/card";

// The three advisors that turn a few answers into a short list of products.
//
// The ranking rules have not changed and still live in lib/oral-care.ts,
// lib/supplement-advisor.ts and lib/skin-recommend.ts. What changed is where
// they run: each of those reads the whole catalogue, and each was imported
// by a quiz component, which put ~650 KB of products in the browser to pick
// four of them.
//
// Nothing here is personal data: answers in, public catalogue out. The skin
// route takes a list of concern keys, not a photograph — the analysis itself
// happens before this and is not sent.

type Body = {
  kind?: string;
  answers?: Record<string, unknown>;
  concerns?: string[];
  skinTypes?: string[];
  exclude?: string[];
  max?: number;
};

const str = (v: unknown) => (typeof v === "string" ? v : "");
const strList = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.kind) return NextResponse.json({ error: "no kind" }, { status: 400 });

  if (body.kind === "oral-care") {
    const items = recommendOralCareSet({
      concerns: strList(body.answers?.concerns),
      using: strList(body.answers?.using),
      setType: str(body.answers?.setType),
    });
    return NextResponse.json({ cards: items.map(toCardData) });
  }

  if (body.kind === "supplement") {
    const { items, blocked } = recommendSupplementPlan({
      goal: str(body.answers?.goal),
      status: str(body.answers?.status),
      budget: str(body.answers?.budget),
    });
    return NextResponse.json({ cards: items.map(toCardData), blocked });
  }

  if (body.kind === "skin") {
    // The loop that was in both callers: a product shown for one concern is
    // not offered again for the next, so no tube appears twice down the page.
    const skinTypes = strList(body.skinTypes) as SkinTypeKey[];
    const alreadyBought = new Set<string>(strList(body.exclude));
    const shown = new Set<string>(alreadyBought);
    const max = Math.min(Math.max(Number(body.max) || 3, 1), 6);

    const groups = strList(body.concerns).map((concern) => {
      const picks = recommendFor(concern as ConcernMetric, { max, exclude: shown, skinTypes });
      picks.forEach((p) => shown.add(p.product.slug));
      // How many of the best answers for this finding the customer owns
      // already — counted against what would have been suggested with
      // nothing excluded, which is what the screen says ("already have N").
      const skipped = recommendFor(concern as ConcernMetric, { max, skinTypes }).filter((p) =>
        alreadyBought.has(p.product.slug)
      ).length;
      return {
        concern,
        skipped,
        picks: picks.map((p) => ({ card: toCardData(p.product), type: p.type, main: p.main })),
      };
    });
    return NextResponse.json({ groups });
  }

  return NextResponse.json({ error: "unknown kind" }, { status: 400 });
}
