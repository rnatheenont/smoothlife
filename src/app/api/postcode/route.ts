import { NextRequest, NextResponse } from "next/server";
import { postcodeIndex } from "@/data/postcodes.generated";

export const runtime = "nodejs";

type Match = { province: string; district: string; subdistricts: string[] };

// postcode -> matches, built once per warm lambda.
let index: Map<string, Match[]> | null = null;

function getIndex() {
  if (index) return index;
  const m = new Map<string, Match[]>();
  for (const line of postcodeIndex) {
    const [zip, province, district, subs] = line.split("|");
    if (!zip || !province || !district) continue;
    const list = m.get(zip) || [];
    list.push({ province, district, subdistricts: (subs || "").split(",").filter(Boolean) });
    m.set(zip, list);
  }
  index = m;
  return m;
}

export async function GET(req: NextRequest) {
  const code = (req.nextUrl.searchParams.get("code") || "").trim();
  const idx = getIndex();

  if (idx.size === 0) {
    return NextResponse.json({ available: false, matches: [] });
  }
  if (!/^\d{5}$/.test(code)) {
    return NextResponse.json({ available: true, matches: [] });
  }

  return NextResponse.json({
    available: true,
    matches: idx.get(code) || [],
  });
}
