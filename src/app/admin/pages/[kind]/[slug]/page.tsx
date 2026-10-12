"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Eye,
  EyeOff,
  Loader2,
  Megaphone,
  Monitor,
  Plus,
  RefreshCw,
  BookmarkPlus,
  Clock,
  Copy,
  LayoutTemplate,
  Rocket,
  Smartphone,
  Trash2,
  TriangleAlert,
  Undo2,
} from "lucide-react";

import { PageHeader } from "@/components/admin/layout-kit";
import { Card } from "@/components/ui";
import SectionForm from "@/components/admin/pages/SectionForm";
import type { PageDoc } from "@/lib/pages/doc";
import {
  addSection,
  moveSection,
  newSectionId,
  removeSection,
  toggleHidden as toggleHiddenIn,
  updateSettings,
} from "@/lib/pages/edit";
import type { FieldDef } from "@/lib/pages/types";
import { bangkokInputToIso, bangkokLabel, isoToBangkokInput } from "@/lib/pages/bangkok-time";
import { PHASE_LABEL, PHASE_ORDER } from "@/lib/pages/campaign";
import { campaignPhaseAt, type CampaignPhase } from "@/lib/pages/doc";

// The page editor.
//
// Two panels rather than three for now: what the page is made of on the left,
// the selected section's settings on the right. The live preview in the middle
// arrives with draft mode in the next step; until then the ordering, the
// visibility and the settings are all editable and all save.
//
// Every edit writes to the draft. Nothing here touches what a customer sees
// until someone presses เผยแพร่.

type LibraryEntry = {
  type: string;
  version: number;
  label: string;
  description: string;
  category: string;
  maxPerPage: number | null;
  defaults: Record<string, unknown>;
  fields: FieldDef[];
};

type TemplateRow = {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
};

type Revision = {
  id: string;
  number: number;
  note: string | null;
  published_by: string | null;
  published_at: string;
};

type PageInfo = {
  id: string;
  kind: string;
  slug: string;
  title: string;
  status: string;
  draftVersion: number;
  draftUpdatedBy: string | null;
  draftUpdatedAt: string;
  publishedRevisionId: string | null;
  publishAt: string | null;
  unpublishAt: string | null;
  campaign: {
    teaserAt: string | null;
    liveAt: string | null;
    extendedAt: string | null;
    endsAt: string | null;
    takeoverHome: boolean;
    theme: { accent?: string; background?: string; badgeText?: string } | null;
  } | null;
};

/** The campaign panel's own form state. The four dates are held as the
 *  strings a datetime-local gives back and converted on save, so what is in
 *  the box is always exactly what was typed. */
type CampaignForm = {
  teaserAt: string;
  liveAt: string;
  extendedAt: string;
  endsAt: string;
  accent: string;
  background: string;
  badgeText: string;
  takeoverHome: boolean;
};

const EMPTY_CAMPAIGN: CampaignForm = {
  teaserAt: "",
  liveAt: "",
  extendedAt: "",
  endsAt: "",
  accent: "",
  background: "",
  badgeText: "",
  takeoverHome: false,
};

type SaveState = "idle" | "dirty" | "saving" | "saved" | "conflict" | "error";

const AUTOSAVE_MS = 1200;

export default function PageEditor(props: { params: Promise<{ kind: string; slug: string }> }) {
  const { kind, slug } = use(props.params);

  const [page, setPage] = useState<PageInfo | null>(null);
  const [doc, setDoc] = useState<PageDoc | null>(null);
  const [library, setLibrary] = useState<LibraryEntry[]>([]);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [issues, setIssues] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{ by: string | null; at: string | null } | null>(null);
  const [adding, setAdding] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [device, setDevice] = useState<"mobile" | "desktop">("desktop");
  const [confirming, setConfirming] = useState(false);
  const [rollingBack, setRollingBack] = useState<string | null>(null);
  // Bumped to reload the iframe. The preview renders the draft on the server,
  // so it only changes once a save has landed — refreshing before that would
  // show the version before the edit and look like the editor had lost it.
  const [previewNonce, setPreviewNonce] = useState(0);
  const [scheduling, setScheduling] = useState(false);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [applying, setApplying] = useState<string | null>(null);
  const [confirmApply, setConfirmApply] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState(false);
  const [copySlug, setCopySlug] = useState("");
  const [camp, setCamp] = useState<CampaignForm>(EMPTY_CAMPAIGN);
  const [savingCampaign, setSavingCampaign] = useState(false);
  const [previewPhase, setPreviewPhase] = useState<CampaignPhase | "now">("now");
  const router = useRouter();
  const [publishAt, setPublishAt] = useState("");
  const [unpublishAt, setUnpublishAt] = useState("");

  // The version this editor read. Every save carries it, and the server
  // refuses a save that does not match — see saveDraft.
  const versionRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/pages/templates");
      const data = await res.json();
      if (res.ok && data.ok) setTemplates(data.templates);
    } catch {
      // A template list that failed to load is a missing convenience, not a
      // broken editor — the page itself is already on screen.
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/pages/${kind}/${slug}`);
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error ?? "โหลดเพจไม่สำเร็จ");
      setPage(data.page);
      setDoc(data.doc);
      setLibrary(data.library);
      setRevisions(data.revisions);
      setIssues(data.issues ?? []);
      versionRef.current = data.page.draftVersion;
      setSelected((cur) => cur ?? data.doc.sections[0]?.id ?? null);
      setPublishAt(isoToBangkokInput(data.page.publishAt));
      setUnpublishAt(isoToBangkokInput(data.page.unpublishAt));
      const c = data.page.campaign;
      setCamp(
        c
          ? {
              teaserAt: isoToBangkokInput(c.teaserAt),
              liveAt: isoToBangkokInput(c.liveAt),
              extendedAt: isoToBangkokInput(c.extendedAt),
              endsAt: isoToBangkokInput(c.endsAt),
              accent: c.theme?.accent ?? "",
              background: c.theme?.background ?? "",
              badgeText: c.theme?.badgeText ?? "",
              takeoverHome: c.takeoverHome,
            }
          : EMPTY_CAMPAIGN
      );
      setSaveState("idle");
      setConflict(null);
      void loadTemplates();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "โหลดเพจไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [kind, slug, loadTemplates]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(
    async (next: PageDoc) => {
      setSaveState("saving");
      try {
        const res = await fetch(`/api/admin/pages/${kind}/${slug}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ doc: next, version: versionRef.current }),
        });
        const data = await res.json();
        if (res.status === 409) {
          // Stop autosaving. Carrying on would mean every keystroke firing a
          // request that cannot succeed, and the person needs to decide what
          // to do about the other edit before anything else happens.
          setConflict({ by: data?.conflict?.by ?? null, at: data?.conflict?.at ?? null });
          setSaveState("conflict");
          return;
        }
        if (!res.ok || !data.ok) throw new Error(data?.error ?? "บันทึกไม่สำเร็จ");
        versionRef.current = data.version;
        setSaveState("saved");
        setPreviewNonce((n) => n + 1);
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
        setSaveState("error");
      }
    },
    [kind, slug]
  );

  /** Every change goes through here: update what is on screen now, and queue
   *  the write. Typing should never wait for the network. */
  const edit = useCallback(
    (next: PageDoc) => {
      setDoc(next);
      if (saveState === "conflict") return;
      setSaveState("dirty");
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => void save(next), AUTOSAVE_MS);
    },
    [save, saveState]
  );

  // A draft in a closed tab is a draft nobody has. Flushing on the way out
  // covers the gap between the last keystroke and the autosave that had not
  // fired yet.
  useEffect(() => {
    function flush() {
      if (timerRef.current) clearTimeout(timerRef.current);
    }
    window.addEventListener("beforeunload", flush);
    return () => {
      flush();
      window.removeEventListener("beforeunload", flush);
    };
  }, []);

  const byType = useMemo(() => new Map(library.map((l) => [l.type, l])), [library]);
  const current = doc?.sections.find((s) => s.id === selected) ?? null;
  const currentDef = current ? byType.get(current.type) : null;

  // The document operations live in lib/pages/edit, where they are unit
  // tested — an off-by-one that drops the last section or a delete that takes
  // the wrong one are quiet mistakes, and quiet mistakes belong in tests
  // rather than in a button handler.
  function move(id: string, delta: number) {
    if (doc) edit(moveSection(doc, id, delta));
  }

  function toggleHidden(id: string) {
    if (doc) edit(toggleHiddenIn(doc, id));
  }

  function remove(id: string) {
    if (!doc) return;
    edit(removeSection(doc, id));
    if (selected === id) setSelected(null);
  }

  function add(entry: LibraryEntry) {
    if (!doc) return;
    const id = newSectionId();
    edit(addSection(doc, entry, id));
    setSelected(id);
    setAdding(false);
  }

  /** Push the pending autosave through before an action that reads the draft
   *  from the database. Without this, saving a template a second after an
   *  edit stores the version without that edit. */
  const flushDraft = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (doc && (saveState === "dirty" || saveState === "error")) await save(doc);
  }, [doc, save, saveState]);

  async function saveAsTemplate() {
    setSavingTemplate(true);
    setMessage(null);
    try {
      await flushDraft();
      const res = await fetch("/api/admin/pages/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", fromKind: kind, fromSlug: slug, name: templateName }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error ?? "บันทึก template ไม่สำเร็จ");
      setTemplateName("");
      setMessage(`เก็บเป็น template "${data.template?.name ?? templateName}" แล้ว`);
      await loadTemplates();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "บันทึก template ไม่สำเร็จ");
    } finally {
      setSavingTemplate(false);
    }
  }

  async function applyTemplate(templateId: string) {
    setApplying(templateId);
    setMessage(null);
    try {
      // The pending autosave is dropped on purpose: it carries the document
      // this is about to replace, and letting it land after the template
      // would undo the thing just asked for.
      if (timerRef.current) clearTimeout(timerRef.current);
      const res = await fetch("/api/admin/pages/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "apply", templateId, toKind: kind, toSlug: slug }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error ?? "ใช้ template ไม่สำเร็จ");
      setSelected(null);
      setConfirmApply(null);
      setMessage("เปลี่ยนร่างเป็น template แล้ว — หน้าที่เผยแพร่อยู่ยังไม่เปลี่ยน");
      await load();
      setPreviewNonce((n) => n + 1);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "ใช้ template ไม่สำเร็จ");
    } finally {
      setApplying(null);
    }
  }

  async function duplicatePage() {
    setDuplicating(true);
    setMessage(null);
    try {
      await flushDraft();
      const res = await fetch("/api/admin/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "duplicate",
          fromKind: kind,
          fromSlug: slug,
          // A copy of a campaign is a campaign, not a plain page — the server
          // defaults to fromKind, but saying it here keeps the redirect below
          // honest about where it is going.
          kind,
          slug: copySlug,
          title: `${page?.title ?? slug} (สำเนา)`,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error ?? "คัดลอกหน้าไม่สำเร็จ");
      // Straight to the copy: the reason for copying is to work on the copy,
      // and leaving the person on the original means finding it again.
      router.push(`/admin/pages/${data.page.kind}/${data.page.slug}`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "คัดลอกหน้าไม่สำเร็จ");
      setDuplicating(false);
    }
  }

  async function saveCampaign() {
    setSavingCampaign(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/pages/${kind}/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "campaign",
          times: {
            teaserAt: bangkokInputToIso(camp.teaserAt),
            liveAt: bangkokInputToIso(camp.liveAt),
            extendedAt: bangkokInputToIso(camp.extendedAt),
            endsAt: bangkokInputToIso(camp.endsAt),
          },
          theme: {
            accent: camp.accent.trim() || undefined,
            background: camp.background.trim() || undefined,
            badgeText: camp.badgeText.trim() || undefined,
          },
          takeoverHome: camp.takeoverHome,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error ?? "บันทึกค่าแคมเปญไม่สำเร็จ");
      setMessage("บันทึกค่าแคมเปญแล้ว");
      await load();
      setPreviewNonce((n) => n + 1);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "บันทึกค่าแคมเปญไม่สำเร็จ");
    } finally {
      setSavingCampaign(false);
    }
  }

  async function saveSchedule() {
    setScheduling(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/pages/${kind}/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "schedule",
          publishAt: bangkokInputToIso(publishAt),
          unpublishAt: bangkokInputToIso(unpublishAt),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error ?? "ตั้งเวลาไม่สำเร็จ");
      setMessage("บันทึกเวลาแล้ว");
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "ตั้งเวลาไม่สำเร็จ");
    } finally {
      setScheduling(false);
    }
  }

  async function rollbackTo(revisionId: string, number: number) {
    setRollingBack(revisionId);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/pages/${kind}/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rollback", revisionId }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error ?? "ย้อนกลับไม่สำเร็จ");
      setMessage(`หน้าเว็บกลับไปใช้เวอร์ชัน ${number} แล้ว — ร่างที่กำลังแก้อยู่ไม่ถูกแตะต้อง`);
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "ย้อนกลับไม่สำเร็จ");
    } finally {
      setRollingBack(null);
    }
  }

  async function publishNow() {
    setConfirming(false);
    setPublishing(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/pages/${kind}/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "publish" }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setIssues(data?.issues ?? []);
        throw new Error(data?.error ?? "เผยแพร่ไม่สำเร็จ");
      }
      setMessage(`เผยแพร่เวอร์ชัน ${data.number} แล้ว`);
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "เผยแพร่ไม่สำเร็จ");
    } finally {
      setPublishing(false);
    }
  }

  /** Things worth a second look that are not wrong. Errors come from the
   *  server (validateForPublish) because they decide whether publishing is
   *  allowed; these are read off the document here because they only need to
   *  be seen, and seeing them should not cost a round trip. */
  const warnings = useMemo(() => {
    const out: string[] = [];
    const sections = doc?.sections ?? [];
    const hidden = sections.filter((s) => s.common?.hidden).length;
    if (hidden > 0) out.push(`มี section ที่ซ่อนอยู่ ${hidden} อัน — จะไม่ขึ้นบนหน้าจริง`);
    if (sections.length > 20) {
      out.push(`หน้านี้มี ${sections.length} section — เกิน 20 อันจะถูกตัดออกตอนแสดงผล`);
    }
    const scheduled = sections.filter((s) => s.common?.visibleFrom || s.common?.visibleUntil).length;
    if (scheduled > 0) out.push(`มี section ที่ตั้งเวลาไว้ ${scheduled} อัน — ตรวจวันเวลาอีกครั้ง`);
    return out;
  }, [doc]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of doc?.sections ?? []) map.set(s.type, (map.get(s.type) ?? 0) + 1);
    return map;
  }, [doc]);

  if (loading) return <p className="px-4 py-10 text-center text-sm text-slate-500">กำลังโหลด…</p>;
  if (!page || !doc) {
    return <p className="px-4 py-10 text-center text-sm text-rose-600">{message ?? "ไม่พบเพจนี้"}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={page.title}
        subtitle={`${page.kind}/${page.slug} · แก้ล่าสุดโดย ${page.draftUpdatedBy ?? "—"}`}
        actions={
          <div className="flex items-center gap-3">
            <SaveBadge state={saveState} />
            <button
              onClick={() => setConfirming(true)}
              disabled={publishing || saveState === "conflict"}
              className="flex h-11 items-center gap-2 rounded-full bg-brand-gradient px-5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {publishing ? <Loader2 size={15} className="animate-spin" /> : <Rocket size={15} />}
              เผยแพร่
            </button>
          </div>
        }
      />

      {conflict && (
        <div className="rounded-xl2 border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">มีคนแก้หน้านี้ไปแล้วหลังจากที่คุณเปิด</p>
          <p className="mt-1">
            ล่าสุดโดย {conflict.by ?? "—"}
            {conflict.at ? ` เมื่อ ${new Date(conflict.at).toLocaleString("th-TH")}` : ""} ·
            หยุดบันทึกอัตโนมัติไว้แล้วเพื่อไม่ให้ทับงานของเขา
          </p>
          <button
            onClick={() => void load()}
            className="mt-2 h-10 rounded-full bg-amber-900 px-4 text-[13px] font-semibold text-white"
          >
            โหลดเวอร์ชันล่าสุดมาแก้ต่อ (ทิ้งที่แก้ค้างไว้)
          </button>
        </div>
      )}

      {message && !conflict && <p className="text-sm text-slate-600">{message}</p>}

      {issues.length > 0 && (
        <div className="rounded-xl2 border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <p className="flex items-center gap-1.5 font-semibold">
            <TriangleAlert size={15} /> ยังเผยแพร่ไม่ได้
          </p>
          <ul className="mt-1 list-disc pl-5">
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      )}

      {confirming && (
        // The checklist before the page goes live. Errors from the server
        // keep the button disabled; warnings only ask to be read. The split
        // matters: a dialog where everything is equally alarming is a dialog
        // people learn to click through.
        <div className="fixed inset-0 z-100 grid place-items-center p-4">
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-black/40"
            onClick={() => setConfirming(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="publish-title"
            className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
          >
            <h2 id="publish-title" className="text-base font-bold text-brand-ink">
              เผยแพร่หน้านี้?
            </h2>
            <p className="mt-1 text-[13px] text-slate-500">
              ร่างปัจจุบันจะกลายเป็นหน้าที่ลูกค้าเห็น และถูกเก็บเป็นเวอร์ชันใหม่ ย้อนกลับได้ภายหลังด้วยปุ่มเดียว
            </p>

            <dl className="mt-4 flex flex-col gap-1.5 text-[13px]">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">section ที่จะขึ้นหน้าเว็บ</dt>
                <dd className="font-semibold text-brand-ink">
                  {(doc.sections.filter((s) => !s.common?.hidden) ?? []).length} อัน
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">ร่างล่าสุดบันทึกเมื่อ</dt>
                <dd className="font-semibold text-brand-ink">
                  {new Date(page.draftUpdatedAt).toLocaleString("th-TH")}
                </dd>
              </div>
            </dl>

            {issues.length > 0 && (
              <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-[13px] text-rose-800">
                <p className="font-semibold">ต้องแก้ก่อนถึงจะเผยแพร่ได้</p>
                <ul className="mt-1 list-disc pl-5">
                  {issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              </div>
            )}

            {warnings.length > 0 && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] text-amber-900">
                <p className="font-semibold">ตรวจอีกครั้งก่อนไหม</p>
                <ul className="mt-1 list-disc pl-5">
                  {warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {saveState === "dirty" && (
              <p className="mt-3 text-[13px] text-amber-700">
                ยังมีการแก้ที่ยังไม่ได้บันทึก — รอสักครู่ให้บันทึกเสร็จก่อนเผยแพร่
              </p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setConfirming(false)}
                className="h-11 rounded-full border border-slate-200 px-4 text-sm font-semibold text-slate-600"
              >
                ยกเลิก
              </button>
              <button
                onClick={publishNow}
                disabled={issues.length > 0 || saveState === "dirty" || saveState === "saving"}
                className="h-11 rounded-full bg-brand-gradient px-5 text-sm font-semibold text-white disabled:opacity-50"
              >
                เผยแพร่เลย
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,20rem)_minmax(0,1fr)_minmax(0,22rem)]">
        <Card padded={false}>
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-bold text-brand-ink">section ในหน้านี้ ({doc.sections.length})</h2>
            <button
              onClick={() => setAdding((v) => !v)}
              className="flex h-10 items-center gap-1.5 rounded-full border border-slate-200 px-3 text-[13px] font-semibold text-brand-800"
            >
              <Plus size={14} /> เพิ่ม
            </button>
          </div>

          {adding && (
            <div className="max-h-72 overflow-y-auto border-b border-slate-100 bg-surface-soft/60 p-2">
              {library.map((entry) => {
                const used = counts.get(entry.type) ?? 0;
                const full = entry.maxPerPage != null && used >= entry.maxPerPage;
                return (
                  <button
                    key={entry.type}
                    onClick={() => add(entry)}
                    disabled={full}
                    className="block w-full rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-white disabled:opacity-45"
                  >
                    <span className="text-[13px] font-semibold text-brand-ink">{entry.label}</span>
                    <span className="block text-[12px] text-slate-500">
                      {full ? `ใส่ครบแล้ว (สูงสุด ${entry.maxPerPage})` : entry.description}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <ol className="p-2">
            {doc.sections.map((section, i) => {
              const def = byType.get(section.type);
              const hidden = Boolean(section.common?.hidden);
              const active = section.id === selected;
              return (
                <li key={section.id}>
                  <div
                    className={`flex items-center gap-1 rounded-lg px-2 py-1.5 ${active ? "bg-brand-gradient-soft" : "hover:bg-surface-soft"}`}
                  >
                    <button
                      onClick={() => setSelected(section.id)}
                      className="min-w-0 flex-1 text-left"
                      aria-current={active ? "true" : undefined}
                    >
                      <span
                        className={`block truncate text-[13px] font-semibold ${hidden ? "text-slate-400 line-through" : "text-brand-ink"}`}
                      >
                        {def?.label ?? section.type}
                      </span>
                      {!def && <span className="block text-[11px] text-rose-600">ไม่รู้จัก section ชนิดนี้</span>}
                    </button>
                    <button
                      onClick={() => move(section.id, -1)}
                      disabled={i === 0}
                      aria-label={`ย้าย ${def?.label ?? section.type} ขึ้น`}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-400 hover:text-brand-800 disabled:opacity-30"
                    >
                      <ArrowUp size={15} />
                    </button>
                    <button
                      onClick={() => move(section.id, 1)}
                      disabled={i === doc.sections.length - 1}
                      aria-label={`ย้าย ${def?.label ?? section.type} ลง`}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-400 hover:text-brand-800 disabled:opacity-30"
                    >
                      <ArrowDown size={15} />
                    </button>
                    <button
                      onClick={() => toggleHidden(section.id)}
                      aria-label={hidden ? `แสดง ${def?.label}` : `ซ่อน ${def?.label}`}
                      aria-pressed={hidden}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-400 hover:text-brand-800"
                    >
                      {hidden ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                    <button
                      onClick={() => remove(section.id)}
                      aria-label={`ลบ ${def?.label ?? section.type}`}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>

          {kind === "campaign" && (
            /* A campaign's own settings: when it runs, what colour it is, and
               whether it takes over the home page. Together with the phase
               switcher over the preview, this is the whole of what makes a
               campaign page different from any other page. */
            <div className="border-t border-slate-100 px-4 py-3">
              <h3 className="text-[12px] font-bold text-slate-500">ช่วงเวลาแคมเปญ (เวลาไทย)</h3>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {(
                  [
                    ["teaserAt", "ก่อนเริ่ม (teaser)"],
                    ["liveAt", "วันงาน (live)"],
                    ["extendedAt", "ขยายเวลา (ไม่บังคับ)"],
                    ["endsAt", "จบแคมเปญ"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="text-[12px] text-slate-500">
                    {label}
                    <input
                      type="datetime-local"
                      value={camp[key]}
                      onChange={(e) => setCamp((c) => ({ ...c, [key]: e.target.value }))}
                      className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-2.5 text-[13px] outline-hidden focus-visible:border-brand-teal"
                    />
                  </label>
                ))}
              </div>

              <h3 className="mt-4 text-[12px] font-bold text-slate-500">สีของแคมเปญ</h3>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                มีผลแค่ในหน้าแคมเปญนี้ ไม่แตะสีของเว็บส่วนอื่น · สีตัวอักษรบนสีหลักระบบเลือกให้เอง
                (ขาวหรือเข้ม อันไหน contrast ดีกว่า) ถ้าไม่มีอันไหนถึง 4.5:1 จะเผยแพร่ไม่ได้
              </p>
              <div className="mt-2 flex flex-col gap-2">
                {(
                  [
                    ["accent", "สีหลัก", "#E0245E"],
                    ["background", "สีพื้นหลัง", "#FFF7F9"],
                  ] as const
                ).map(([key, label, placeholder]) => (
                  <label key={key} className="flex items-center gap-2 text-[12px] text-slate-500">
                    <span className="w-20 shrink-0">{label}</span>
                    {/* Both controls edit one value: the swatch for picking,
                        the text box because a brand colour arrives as a hex
                        code in a message, not as a point on a gradient. */}
                    <input
                      type="color"
                      value={/^#[0-9a-fA-F]{6}$/.test(camp[key]) ? camp[key] : "#ffffff"}
                      onChange={(e) => setCamp((c) => ({ ...c, [key]: e.target.value.toUpperCase() }))}
                      aria-label={`เลือก${label}`}
                      className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-slate-200 bg-white p-1"
                    />
                    <input
                      value={camp[key]}
                      onChange={(e) => setCamp((c) => ({ ...c, [key]: e.target.value }))}
                      placeholder={placeholder}
                      aria-label={label}
                      className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 px-2.5 font-mono text-[13px] outline-hidden focus-visible:border-brand-teal"
                    />
                  </label>
                ))}
                <label className="flex items-center gap-2 text-[12px] text-slate-500">
                  <span className="w-20 shrink-0">ป้ายบนรูป</span>
                  <input
                    value={camp.badgeText}
                    onChange={(e) => setCamp((c) => ({ ...c, badgeText: e.target.value }))}
                    placeholder="11.11"
                    aria-label="ข้อความบนป้ายสินค้า"
                    maxLength={12}
                    className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 px-2.5 text-[13px] outline-hidden focus-visible:border-brand-teal"
                  />
                </label>
              </div>

              <label className="mt-3 flex items-start gap-2 text-[12px] leading-relaxed text-slate-600">
                <input
                  type="checkbox"
                  checked={camp.takeoverHome}
                  onChange={(e) => setCamp((c) => ({ ...c, takeoverHome: e.target.checked }))}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-brand-800"
                />
                ให้แคมเปญนี้ขึ้นหน้าแรกตอนที่กำลังจัด (ต้องมี section &quot;ช่องแคมเปญ&quot; วางไว้ในหน้าแรกแล้ว)
              </label>

              <button
                onClick={() => void saveCampaign()}
                disabled={savingCampaign}
                className="mt-3 flex h-10 w-full items-center justify-center gap-1.5 rounded-full border border-slate-200 text-[13px] font-semibold text-brand-800 disabled:opacity-60"
              >
                {savingCampaign ? <Loader2 size={13} className="animate-spin" /> : <Megaphone size={13} />}
                บันทึกค่าแคมเปญ
              </button>
              {page.campaign?.liveAt && (
                <p className="mt-1.5 text-[11px] text-slate-400">
                  ตอนนี้อยู่ช่วง{" "}
                  <span className="font-semibold text-brand-800">
                    {PHASE_LABEL[campaignPhaseAt(page.campaign, new Date())]}
                  </span>{" "}
                  · วันงาน {bangkokLabel(page.campaign.liveAt)}
                </p>
              )}
            </div>
          )}

          {/* Scheduling. Deliberately under the section list rather than in
              the publish dialog: a time set on a page is a property of the
              page, not of the one press of a button, and burying it in a
              dialog is how it gets set once and then forgotten about. */}
          <div className="border-t border-slate-100 px-4 py-3">
            <h3 className="text-[12px] font-bold text-slate-500">ตั้งเวลา (เวลาไทย)</h3>
            <div className="mt-2 flex flex-col gap-2">
              <label className="text-[12px] text-slate-500">
                เผยแพร่เมื่อ
                <input
                  type="datetime-local"
                  value={publishAt}
                  onChange={(e) => setPublishAt(e.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-2.5 text-[13px] outline-hidden focus-visible:border-brand-teal"
                />
              </label>
              <label className="text-[12px] text-slate-500">
                ปิดหน้าเมื่อ
                <input
                  type="datetime-local"
                  value={unpublishAt}
                  onChange={(e) => setUnpublishAt(e.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-2.5 text-[13px] outline-hidden focus-visible:border-brand-teal"
                />
              </label>
              <button
                onClick={() => void saveSchedule()}
                disabled={scheduling}
                className="flex h-10 items-center justify-center gap-1.5 rounded-full border border-slate-200 text-[13px] font-semibold text-brand-800 disabled:opacity-60"
              >
                {scheduling ? <Loader2 size={13} className="animate-spin" /> : <Clock size={13} />}
                บันทึกเวลา
              </button>
              {/* Said plainly, because "ตั้งเวลา 09:00" sounds like a promise
                  of 09:00:00 and the checker runs once a minute. */}
              <p className="text-[11px] leading-relaxed text-slate-400">
                ระบบตรวจทุก 1 นาที — หน้าจะขึ้นภายใน 1 นาทีหลังเวลาที่ตั้งไว้
                {page.publishAt && ` · ตั้งไว้ ${bangkokLabel(page.publishAt)}`}
              </p>
            </div>
          </div>

          {/* Templates and copies. A template is an arrangement of sections
              with the ids stripped; applying one replaces the draft and
              leaves the published page alone, which is why it needs no
              scarier warning than the one on the button. */}
          <div className="border-t border-slate-100 px-4 py-3">
            <h3 className="text-[12px] font-bold text-slate-500">template และสำเนา</h3>

            <div className="mt-2 flex gap-2">
              <input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="ชื่อ template ที่จะเก็บ…"
                aria-label="ชื่อ template ที่จะเก็บจากหน้านี้"
                className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 px-2.5 text-[13px] outline-hidden focus-visible:border-brand-teal"
              />
              <button
                onClick={() => void saveAsTemplate()}
                disabled={savingTemplate || !templateName.trim() || (doc?.sections.length ?? 0) === 0}
                className="flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-slate-200 px-3 text-[13px] font-semibold text-brand-800 disabled:opacity-50"
              >
                {savingTemplate ? <Loader2 size={13} className="animate-spin" /> : <BookmarkPlus size={13} />}
                เก็บไว้
              </button>
            </div>

            {templates.length > 0 && (
              <ul className="mt-2 flex flex-col gap-1">
                {templates.map((t) => (
                  <li key={t.id} className="flex items-center gap-2 text-[12px] text-slate-500">
                    <span className="min-w-0 flex-1 truncate">
                      {t.name}
                      {t.is_system && <span className="ml-1 text-slate-400">(ของระบบ)</span>}
                    </span>
                    {confirmApply === t.id ? (
                      <>
                        <button
                          onClick={() => void applyTemplate(t.id)}
                          disabled={applying !== null}
                          className="flex h-9 shrink-0 items-center gap-1 rounded-full bg-brand-gradient px-2.5 font-semibold text-white disabled:opacity-50"
                        >
                          {applying === t.id && <Loader2 size={12} className="animate-spin" />}
                          ทับร่างเดิม
                        </button>
                        <button
                          onClick={() => setConfirmApply(null)}
                          className="h-9 shrink-0 rounded-full px-2 font-semibold text-slate-500"
                        >
                          ยกเลิก
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setConfirmApply(t.id)}
                        className="flex h-9 shrink-0 items-center gap-1 rounded-full border border-slate-200 px-2.5 font-semibold text-brand-800"
                      >
                        <LayoutTemplate size={12} /> ใช้แบบนี้
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-3 flex gap-2">
              <span className="flex h-10 min-w-0 flex-1 items-center rounded-lg border border-slate-200 pl-2.5">
                <span className="shrink-0 text-[13px] text-slate-400">/p/</span>
                <input
                  value={copySlug}
                  onChange={(e) => setCopySlug(e.target.value)}
                  placeholder="ที่อยู่ของสำเนา"
                  aria-label="ที่อยู่ของหน้าสำเนา"
                  className="h-full min-w-0 flex-1 rounded-r-lg px-1 text-[13px] outline-hidden"
                />
              </span>
              <button
                onClick={() => void duplicatePage()}
                disabled={duplicating || !copySlug.trim()}
                className="flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-slate-200 px-3 text-[13px] font-semibold text-brand-800 disabled:opacity-50"
              >
                {duplicating ? <Loader2 size={13} className="animate-spin" /> : <Copy size={13} />}
                ทำสำเนา
              </button>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
              สำเนาเริ่มเป็นร่างเสมอ แม้ต้นฉบับจะเผยแพร่อยู่ — ลูกค้าจะไม่เห็นสองหน้าพร้อมกัน
            </p>
          </div>

          {revisions.length > 0 && (
            <div className="border-t border-slate-100 px-4 py-3">
              <h3 className="text-[12px] font-bold text-slate-500">เวอร์ชันที่เผยแพร่แล้ว</h3>
              <ul className="mt-2 flex flex-col gap-1">
                {revisions.slice(0, 5).map((r) => {
                  const live = r.id === page.publishedRevisionId;
                  return (
                    <li key={r.id} className="flex items-center gap-2 text-[12px] text-slate-500">
                      <span className="min-w-0 flex-1 truncate">
                        #{r.number} · {new Date(r.published_at).toLocaleString("th-TH")} · {r.published_by ?? "—"}
                        {live && <span className="ml-1 font-semibold text-brand-800">(ใช้อยู่)</span>}
                      </span>
                      {!live && (
                        <button
                          onClick={() => void rollbackTo(r.id, r.number)}
                          disabled={rollingBack !== null}
                          className="flex h-9 shrink-0 items-center gap-1 rounded-full border border-slate-200 px-2.5 font-semibold text-brand-800 disabled:opacity-50"
                        >
                          {rollingBack === r.id ? <Loader2 size={12} className="animate-spin" /> : <Undo2 size={12} />}
                          ใช้อันนี้
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </Card>

        <Card padded={false} className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-bold text-brand-ink">ตัวอย่างร่าง</h2>
            <div className="flex items-center gap-1">
              {kind === "campaign" && (
                /* "ดูในช่วง" — the question worth answering before publishing
                   is what the page looks like on the day and a week after,
                   neither of which is today. */
                <select
                  value={previewPhase}
                  onChange={(e) => {
                    setPreviewPhase(e.target.value as CampaignPhase | "now");
                    setPreviewNonce((n) => n + 1);
                  }}
                  aria-label="ดูตัวอย่างในช่วงไหน"
                  className="mr-1 h-10 rounded-lg border border-slate-200 px-2 text-[12px] text-brand-800 outline-hidden focus-visible:border-brand-teal"
                >
                  <option value="now">ตามเวลาจริง</option>
                  {PHASE_ORDER.map((phase) => (
                    <option key={phase} value={phase}>
                      ดูในช่วง: {PHASE_LABEL[phase]}
                    </option>
                  ))}
                </select>
              )}
              <button
                onClick={() => setDevice("mobile")}
                aria-pressed={device === "mobile"}
                aria-label="ดูแบบมือถือ"
                className={`grid h-10 w-10 place-items-center rounded-lg ${device === "mobile" ? "bg-brand-gradient-soft text-brand-800" : "text-slate-400 hover:text-brand-800"}`}
              >
                <Smartphone size={16} />
              </button>
              <button
                onClick={() => setDevice("desktop")}
                aria-pressed={device === "desktop"}
                aria-label="ดูแบบคอมพิวเตอร์"
                className={`grid h-10 w-10 place-items-center rounded-lg ${device === "desktop" ? "bg-brand-gradient-soft text-brand-800" : "text-slate-400 hover:text-brand-800"}`}
              >
                <Monitor size={16} />
              </button>
              <button
                onClick={() => setPreviewNonce((n) => n + 1)}
                aria-label="โหลดตัวอย่างใหม่"
                className="grid h-10 w-10 place-items-center rounded-lg text-slate-400 hover:text-brand-800"
              >
                <RefreshCw size={15} />
              </button>
            </div>
          </div>
          <div className="flex justify-center bg-slate-100 p-3">
            {/* The frame renders the saved draft, so it is one save behind
                whatever is being typed. The badge in the header says when
                that save happened; without it a stale frame reads as the
                editor having lost the edit. */}
            <iframe
              key={previewNonce}
              src={`/pages-preview/${kind}/${slug}?v=${previewNonce}${
                kind === "campaign" && previewPhase !== "now" ? `&phase=${previewPhase}` : ""
              }`}
              title="ตัวอย่างร่างของหน้านี้"
              className="h-[70vh] w-full rounded-lg border border-slate-200 bg-white"
              style={device === "mobile" ? { width: 390, maxWidth: "100%" } : undefined}
            />
          </div>
        </Card>

        <Card>
          {current && currentDef ? (
            <>
              <div className="mb-4 border-b border-slate-100 pb-3">
                <h2 className="text-sm font-bold text-brand-ink">{currentDef.label}</h2>
                <p className="mt-0.5 text-[12px] text-slate-500">{currentDef.description}</p>
              </div>
              <SectionForm
                fields={currentDef.fields}
                settings={(current.settings ?? {}) as Record<string, unknown>}
                onChange={(next) => edit(updateSettings(doc, current.id, next))}
              />
            </>
          ) : current ? (
            <p className="text-sm text-rose-600">
              section ชนิด &quot;{current.type}&quot; ไม่อยู่ในคลังแล้ว — ลบออกหรือให้ dev เพิ่มกลับเข้ามา
            </p>
          ) : (
            <p className="text-sm text-slate-500">เลือก section จากรายการทางซ้ายเพื่อแก้ไข</p>
          )}
        </Card>
      </div>
    </div>
  );
}

function SaveBadge({ state }: { state: SaveState }) {
  if (state === "saving") {
    return (
      <span className="flex items-center gap-1.5 text-[13px] text-slate-500">
        <Loader2 size={14} className="animate-spin" /> กำลังบันทึก…
      </span>
    );
  }
  if (state === "saved") {
    return (
      <span className="flex items-center gap-1.5 text-[13px] font-semibold text-brand-800">
        <Check size={14} /> บันทึกร่างแล้ว
      </span>
    );
  }
  if (state === "dirty") return <span className="text-[13px] text-slate-400">ยังไม่ได้บันทึก…</span>;
  if (state === "conflict") return <span className="text-[13px] font-semibold text-amber-700">หยุดบันทึกชั่วคราว</span>;
  if (state === "error") return <span className="text-[13px] font-semibold text-rose-600">บันทึกไม่สำเร็จ</span>;
  return null;
}
