import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { supabaseConfigured, supabaseRest, pgValue } from "@/lib/supabase-server";
import { migrateDoc } from "@/lib/pages/doc";
import { pageTag, type PageRow } from "@/lib/pages/store";
import { nextBoundaryFor, publish } from "@/lib/pages/admin";

// Pages that were set to go live, or stop being live, at a time.
//
// Three jobs, all of them a comparison against the clock:
//   1. scheduled and the moment has come  → publish the draft
//   2. published and its end has come     → stop showing it
//   3. a section inside a published page crossed its own window → re-render
//
// The third is why next_boundary_at exists. Without it this would have to
// open every published document every minute to find out whether anything
// inside it had changed; with it the question is one indexed comparison.
//
// Scheduled from Supabase (pg_cron + pg_net) like the others — Vercel's Hobby
// plan allows one cron a day, and a page that goes live tomorrow instead of
// at nine this morning is not a schedule.

async function authorized(req: NextRequest) {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (token) {
    if (process.env.CRON_SECRET && token === process.env.CRON_SECRET) return true;
    try {
      const ok = await supabaseRest<boolean>("rpc/fs_cron_token_ok", {
        method: "POST",
        body: JSON.stringify({ p_token: token }),
      });
      if (ok === true) return true;
    } catch {
      // fall through to the admin cookie
    }
  }
  return verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value);
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function clear(page: Pick<PageRow, "kind" | "slug">) {
  revalidateTag(pageTag(page.kind, page.slug), { expire: 0 });
  revalidateTag("pages", { expire: 0 });
}

export async function GET(req: NextRequest) {
  if (!(await authorized(req))) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const published: string[] = [];
  const ended: string[] = [];
  const refreshed: string[] = [];

  try {
    // 1. Due to go live.
    const due = await supabaseRest<PageRow[]>(
      `pages?select=*&status=eq.scheduled&publish_at=lte.${encodeURIComponent(nowIso)}&limit=20`
    );
    for (const page of due) {
      const result = await publish({ page, note: "ตั้งเวลาไว้", actor: "scheduler" });
      if (result.ok === true) {
        published.push(`${page.kind}/${page.slug}`);
      } else {
        // A page that cannot be published on time should say so and stop,
        // rather than be retried silently every minute for ever.
        console.error(`[cron/pages-schedule] ${page.kind}/${page.slug} could not be published`, result.issues);
        await supabaseRest(`pages?id=eq.${pgValue(page.id)}`, {
          method: "PATCH",
          returning: false,
          body: JSON.stringify({ status: "draft", publish_at: null }),
        });
      }
    }

    // 2. Due to come down.
    const over = await supabaseRest<PageRow[]>(
      `pages?select=*&status=eq.published&unpublish_at=lte.${encodeURIComponent(nowIso)}&limit=20`
    );
    for (const page of over) {
      await supabaseRest(`pages?id=eq.${pgValue(page.id)}`, {
        method: "PATCH",
        returning: false,
        body: JSON.stringify({ status: "ended", next_boundary_at: null }),
      });
      clear(page);
      ended.push(`${page.kind}/${page.slug}`);
    }

    // 3. A live page crossed one of its own boundaries — a section window
    //    opening or closing, or a campaign turning over to its next phase.
    const crossed = await supabaseRest<PageRow[]>(
      `pages?select=*&status=eq.published&next_boundary_at=lte.${encodeURIComponent(nowIso)}&limit=50`
    );
    for (const page of crossed) {
      const doc = migrateDoc(page.draft_doc);
      await supabaseRest(`pages?id=eq.${pgValue(page.id)}`, {
        method: "PATCH",
        returning: false,
        // The next one *after* this instant, so the same crossing is not
        // found again a minute later and re-cleared for ever.
        body: JSON.stringify({ next_boundary_at: nextBoundaryFor(page, doc, now) }),
      });
      clear(page);
      refreshed.push(`${page.kind}/${page.slug}`);
    }

    return NextResponse.json({ ok: true, published, ended, refreshed });
  } catch (err) {
    console.error("[cron/pages-schedule] failed", err);
    return NextResponse.json({ ok: false, error: "ตรวจเวลาเผยแพร่ไม่สำเร็จ" }, { status: 500 });
  }
}
