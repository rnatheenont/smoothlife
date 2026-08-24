// TEMPORARY — diagnoses why the live-fetched homepage banner falls back to
// the static list in production. Remove this route and getLiveHeroBannersDebug()
// in src/lib/shopify-admin.ts once the cause is confirmed/fixed.
import { NextResponse } from "next/server";
import { getLiveHeroBannersDebug } from "@/lib/shopify-admin";

export async function GET() {
  const debug = await getLiveHeroBannersDebug();
  return NextResponse.json(debug);
}
