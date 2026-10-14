import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, getAdminSession, ADMIN_COOKIE } from "@/lib/admin-auth";
import { supabaseConfigured, supabaseRest, pgValue } from "@/lib/supabase-server";
import {
  collectPublishIssues,
  campaignTimesOf,
  nextBoundaryFor,
  openPage,
  publish,
  rollback,
  saveDraft,
  lockedSectionsLost,
} from "@/lib/pages/admin";
import { isPageDoc, migrateDoc } from "@/lib/pages/doc";
import { validateCampaignTimes } from "@/lib/pages/campaign";
import { checkTheme, type CampaignTheme } from "@/lib/pages/theme";
import { pageTag, servedDoc } from "@/lib/pages/store";
import { editorLink, notifyReview, reviewMessage } from "@/lib/pages/review";
import { getBrand } from "@/data/brands";
import { revalidateTag } from "next/cache";
import { sectionsFor } from "@/sections/registry";
import { PAGE_KINDS } from "@/lib/pages/system-pages";

// One page, for the editor.
//
// GET  — the draft, its version, the section library for this kind of page,
//        and the versions already published. Creates the home page from the
//        built-in document the first time it is opened.
// PUT  — save the draft. Carries the version it was read at; a mismatch is a
//        409 rather than a silent overwrite of somebody else's work.
// POST — publish, put a previous version back, set the schedule, or set a
//        campaign's dates, colours and home-page takeover.

const KINDS = PAGE_KINDS;

function unauthorized() {
  return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
}

function actorOf(token: string | undefined) {
  // A legacy shared-password session has no "who" to record, which is worth
  // storing as such rather than inventing a name for.
  return getAdminSession(token)?.userId ?? "shared-login";
}

async function params(props: { params: Promise<{ kind: string; slug: string }> }) {
  const p = await props.params;
  const kind = KINDS.find((k) => k === p.kind);
  return kind ? { kind, slug: p.slug } : null;
}

export async function GET(req: NextRequest, props: { params: Promise<{ kind: string; slug: string }> }) {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  if (!verifyAdminToken(token)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "not configured" }, { status: 503 });

  const target = await params(props);
  if (!target) return NextResponse.json({ ok: false, error: "ไม่รู้จักประเภทเพจนี้" }, { status: 400 });

  const page = await openPage(target.kind, target.slug, actorOf(token));
  if (!page) return NextResponse.json({ ok: false, error: "ไม่พบเพจนี้" }, { status: 404 });

  const revisions = await supabaseRest<
    { id: string; number: number; note: string | null; published_by: string | null; published_at: string }[]
  >(
    `page_revisions?select=id,number,note,published_by,published_at` +
      `&page_id=eq.${pgValue(page.id)}&order=number.desc&limit=30`
  );

  const doc = migrateDoc(page.draft_doc);
  // Run the whole checklist here, including each section's own check, so the
  // editor says the same thing the publish attempt will say rather than the
  // person finding out on the press.
  const checklist = await collectPublishIssues(doc, page);

  return NextResponse.json({
    ok: true,
    page: {
      id: page.id,
      kind: page.kind,
      slug: page.slug,
      title: page.title,
      status: page.status,
      draftVersion: page.draft_version,
      draftUpdatedBy: page.draft_updated_by,
      draftUpdatedAt: page.draft_updated_at,
      publishedRevisionId: page.published_revision_id,
      publishAt: page.publish_at,
      unpublishAt: page.unpublish_at,
      review: {
        state: page.review_state ?? "none",
        note: page.review_note,
        by: page.review_by,
        at: page.review_at,
        decidedBy: page.review_decided_by,
        decidedAt: page.review_decided_at,
        reply: page.review_reply,
      },
      campaign: {
        ...campaignTimesOf(page),
        takeoverHome: page.takeover_home === true,
        brands: page.campaign_brands ?? [],
        theme: (page.campaign_theme as CampaignTheme | null) ?? null,
      },
    },
    doc,
    // The library panel only ever offers what this kind of page may hold, so
    // a campaign section cannot be dropped onto the home page by hand.
    library: sectionsFor(target.kind).map((def) => ({
      type: def.type,
      version: def.version,
      label: def.label,
      description: def.description,
      category: def.category,
      maxPerPage: def.maxPerPage ?? null,
      // The editor needs these to draw the lock and to keep a pinned card
      // out of the sortable list. It cannot import the registry — that is
      // server code — so the flags travel with the library.
      locked: def.locked ?? false,
      pinned: def.pinned ?? null,
      defaults: def.defaults,
      fields: def.fields,
    })),
    revisions,
    // Errors block the publish button; warnings are only read.
    issues: checklist.errors,
    warnings: checklist.warnings,
  });
}

export async function PUT(req: NextRequest, props: { params: Promise<{ kind: string; slug: string }> }) {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  if (!verifyAdminToken(token)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "not configured" }, { status: 503 });

  const target = await params(props);
  if (!target) return NextResponse.json({ ok: false, error: "ไม่รู้จักประเภทเพจนี้" }, { status: 400 });

  const body = (await req.json().catch(() => null)) as { doc?: unknown; version?: number } | null;
  if (!body || typeof body.version !== "number") {
    return NextResponse.json({ ok: false, error: "ไม่ได้ส่งเลขเวอร์ชันมาด้วย" }, { status: 400 });
  }

  const page = await openPage(target.kind, target.slug, actorOf(token));
  if (!page) return NextResponse.json({ ok: false, error: "ไม่พบเพจนี้" }, { status: 404 });

  // A draft may not take away the machinery. The editor already refuses, so
  // a document that gets this far was written by something else — a stale
  // tab, a script, a hand-rolled request — and this is where that is caught.
  if (isPageDoc(page.draft_doc) && isPageDoc(body.doc)) {
    const lost = lockedSectionsLost(page.draft_doc, body.doc);
    if (lost.length) return NextResponse.json({ ok: false, error: lost.join(" · ") }, { status: 400 });
  }

  const result = await saveDraft({
    pageId: page.id,
    expectedVersion: body.version,
    doc: body.doc,
    actor: actorOf(token),
  });

  if (result.ok === false && result.reason === "conflict") {
    // 409 and the current state, so the editor can say who wrote last and
    // when rather than just refusing.
    return NextResponse.json(
      {
        ok: false,
        error: "มีคนแก้หน้านี้ไปแล้วหลังจากที่คุณเปิด",
        conflict: {
          version: result.current?.draft_version ?? null,
          by: result.current?.draft_updated_by ?? null,
          at: result.current?.draft_updated_at ?? null,
        },
      },
      { status: 409 }
    );
  }
  if (result.ok === false) {
    return NextResponse.json({ ok: false, error: result.issues.join(" · ") }, { status: 400 });
  }

  return NextResponse.json({ ok: true, version: result.version });
}

export async function POST(req: NextRequest, props: { params: Promise<{ kind: string; slug: string }> }) {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  if (!verifyAdminToken(token)) return unauthorized();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "not configured" }, { status: 503 });

  const target = await params(props);
  if (!target) return NextResponse.json({ ok: false, error: "ไม่รู้จักประเภทเพจนี้" }, { status: 400 });

  const body = (await req.json().catch(() => null)) as
    | {
        action?: "publish" | "rollback" | "schedule" | "campaign" | "review-decision";
        note?: string;
        revisionId?: string;
        publishAt?: string | null;
        unpublishAt?: string | null;
        times?: {
          teaserAt?: string | null;
          liveAt?: string | null;
          extendedAt?: string | null;
          endsAt?: string | null;
        };
        theme?: CampaignTheme | null;
        takeoverHome?: boolean;
        brands?: string[];
        /** review-decision */
        decision?: "approved" | "changes";
        reply?: string;
      }
    | null;

  const page = await openPage(target.kind, target.slug, actorOf(token));
  if (!page) return NextResponse.json({ ok: false, error: "ไม่พบเพจนี้" }, { status: 404 });
  const actor = actorOf(token);

  // The decision. Approving publishes in the same step — an approval that
  // leaves the page unpublished is a second thing to remember, and the thing
  // being approved is the page going live.
  if (body?.action === "review-decision") {
    const decision = body.decision === "changes" ? "changes" : "approved";
    const reply = (body.reply ?? "").slice(0, 500) || null;

    if (decision === "changes") {
      await supabaseRest(`pages?id=eq.${pgValue(page.id)}`, {
        method: "PATCH",
        returning: false,
        body: JSON.stringify({
          review_state: "changes",
          review_decided_by: actor,
          review_decided_at: new Date().toISOString(),
          review_reply: reply,
        }),
      });
      await audit("page.review.changes", page.id, `ขอให้แก้${reply ? ` · ${reply}` : ""}`, actor);
      const sent = await notifyReview(
        reviewMessage.changes(page.title, actor, reply ?? "", editorLink(page.kind, page.slug))
      );
      return NextResponse.json({ ok: true, notified: sent });
    }

    const result = await publish({ page, note: `อนุมัติโดย ${actor}`, actor });
    if (result.ok === false) {
      return NextResponse.json({ ok: false, error: result.issues.join(" · "), issues: result.issues }, { status: 400 });
    }
    await supabaseRest(`pages?id=eq.${pgValue(page.id)}`, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify({
        review_state: "approved",
        review_decided_by: actor,
        review_decided_at: new Date().toISOString(),
        review_reply: reply,
      }),
    });
    await audit("page.review.approve", page.id, `อนุมัติและเผยแพร่เวอร์ชัน ${result.number}`, actor);
    const sent = await notifyReview(reviewMessage.approved(page.title, actor, editorLink(page.kind, page.slug)));
    return NextResponse.json({ ok: true, number: result.number, notified: sent });
  }

  if (body?.action === "campaign") {
    if (page.kind !== "campaign") {
      return NextResponse.json({ ok: false, error: "หน้านี้ไม่ใช่เพจแคมเปญ" }, { status: 400 });
    }

    const times = body.times ?? {};
    const theme = body.theme ?? null;
    // Refused here, not only in the publish checklist. These two mistakes are
    // invisible on the page while you are building it — a theme is still a
    // theme at 2:1 contrast, and dates in the wrong order still look like
    // four dates — so the moment to say so is the moment they are typed.
    const issues = [...validateCampaignTimes(times), ...checkTheme(theme)];
    if (issues.length) return NextResponse.json({ ok: false, error: issues.join(" · "), issues }, { status: 400 });

    const updated: Record<string, unknown> = {
      campaign_teaser_at: times.teaserAt ?? null,
      campaign_live_at: times.liveAt ?? null,
      campaign_extended_at: times.extendedAt ?? null,
      campaign_ends_at: times.endsAt ?? null,
      campaign_theme: theme,
      takeover_home: body.takeoverHome === true,
      // Only brands the shop actually sells. A typo here would be a brand
      // page that never shows the bar, with nothing anywhere saying why.
      campaign_brands: (body.brands ?? []).filter((slug) => Boolean(getBrand(slug))),
    };

    // A live campaign whose dates moved needs its boundary recomputed now.
    // Without this the page would keep the boundary it was published with and
    // simply never be told that the sale had started.
    if (page.status === "published") {
      const merged = {
        ...page,
        campaign_teaser_at: times.teaserAt ?? null,
        campaign_live_at: times.liveAt ?? null,
        campaign_extended_at: times.extendedAt ?? null,
        campaign_ends_at: times.endsAt ?? null,
      };
      // The published revision, not the draft — the same distinction as in
      // the scheduler (bug B1). The dates being changed belong to the page
      // that is live; the section windows that go with them have to come
      // from the version that is live too, or a half-finished draft decides
      // when the running campaign next re-renders.
      const servedNow = (await servedDoc(page)) ?? migrateDoc(page.draft_doc);
      updated.next_boundary_at = nextBoundaryFor(merged, servedNow, new Date());
    }

    await supabaseRest(`pages?id=eq.${pgValue(page.id)}`, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify(updated),
    });

    // The colours and the phase are both baked into the cached page, so a
    // change to either has to clear it — otherwise the admin saves a new
    // accent and sees the old one for the next half hour.
    revalidateTag(pageTag(page.kind, page.slug), { expire: 0 });
    revalidateTag("pages", { expire: 0 });
    // The home page's campaign_slot reads this row, so it is stale now too —
    // both when the takeover is switched on and when it is switched off.
    revalidateTag(pageTag("home", "home"), { expire: 0 });
    // So are the brand pages on either side of the change: the ones joining
    // the campaign and the ones dropped from it.
    for (const slug of new Set([...(page.campaign_brands ?? []), ...(body.brands ?? [])])) {
      revalidateTag(pageTag("brand", slug), { expire: 0 });
    }

    await audit(
      "page.campaign",
      page.id,
      `ตั้งค่าแคมเปญ เริ่ม ${times.liveAt ?? "—"} จบ ${times.endsAt ?? "—"}` +
        `${body.takeoverHome ? " · ขึ้นหน้าแรก" : ""}`,
      actor
    );
    return NextResponse.json({ ok: true });
  }

  if (body?.action === "schedule") {
    // Stored as the instants they are; the form collects them in Bangkok
    // time and converts, because an admin typing "09:00" means nine in the
    // morning here, not nine in UTC.
    const publishAt = body.publishAt ?? null;
    const unpublishAt = body.unpublishAt ?? null;
    for (const [label, value] of [["เวลาเผยแพร่", publishAt], ["เวลาปิด", unpublishAt]] as const) {
      if (value !== null && !Number.isFinite(Date.parse(value))) {
        return NextResponse.json({ ok: false, error: `${label}ไม่ใช่วันเวลาที่อ่านได้` }, { status: 400 });
      }
    }
    if (publishAt && unpublishAt && Date.parse(unpublishAt) <= Date.parse(publishAt)) {
      return NextResponse.json({ ok: false, error: "เวลาปิดต้องหลังเวลาเผยแพร่" }, { status: 400 });
    }

    await supabaseRest(`pages?id=eq.${pgValue(page.id)}`, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify({
        publish_at: publishAt,
        unpublish_at: unpublishAt,
        // Only a page that is not already live becomes "scheduled" — setting
        // a future date on a published page means "take it down then", not
        // "stop showing it until then".
        ...(publishAt && page.status !== "published" ? { status: "scheduled" } : {}),
        ...(!publishAt && page.status === "scheduled" ? { status: "draft" } : {}),
      }),
    });
    await audit("page.schedule", page.id, `ตั้งเวลา เผยแพร่ ${publishAt ?? "—"} ปิด ${unpublishAt ?? "—"}`, actor);
    return NextResponse.json({ ok: true });
  }

  if (body?.action === "rollback") {
    if (!body.revisionId) return NextResponse.json({ ok: false, error: "ไม่ได้ระบุเวอร์ชัน" }, { status: 400 });
    const result = await rollback({ page, revisionId: body.revisionId, actor });
    if (result.ok === false) {
      return NextResponse.json({ ok: false, error: result.issues.join(" · ") }, { status: 400 });
    }
    await audit("page.rollback", page.id, `ย้อนกลับไปเวอร์ชัน ${result.number}`, actor);
    return NextResponse.json({ ok: true, number: result.number });
  }

  const result = await publish({ page, note: body?.note, actor });
  if (result.ok === false) {
    // The issues go back as a list as well as a sentence: the editor shows
    // them beside the sections they belong to, not only in a toast.
    return NextResponse.json({ ok: false, error: result.issues.join(" · "), issues: result.issues }, { status: 400 });
  }
  await audit("page.publish", page.id, `เผยแพร่เวอร์ชัน ${result.number}`, actor);
  // Publishing directly settles any request that was open: the page is live,
  // so nothing is waiting, and leaving "รออนุมัติ" on a published page would
  // send somebody to approve what is already on the site.
  if (page.review_state === "requested") {
    await supabaseRest(`pages?id=eq.${pgValue(page.id)}`, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify({ review_state: "approved", review_decided_by: actor, review_decided_at: new Date().toISOString() }),
    });
  }
  return NextResponse.json({ ok: true, number: result.number });
}

/** Best effort: a page that went live is more important than its log line. */
async function audit(action: string, target: string, detail: string, actor: string) {
  try {
    await supabaseRest("admin_audit_log", {
      method: "POST",
      returning: false,
      body: JSON.stringify({ action, actor, target, detail }),
    });
  } catch (err) {
    console.error("[pages] could not write the audit entry", err);
  }
}
