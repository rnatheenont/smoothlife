"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowDown,
  ArrowLeft,
  BarChart3,
  ArrowUp,
  Check,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  Maximize2,
  Minimize2,
  Megaphone,
  Monitor,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  RefreshCw,
  BookmarkPlus,
  Clock,
  Copy,
  LayoutTemplate,
  Rocket,
  Send,
  Smartphone,
  Tablet,
  Trash2,
  TriangleAlert,
  Undo2,
  X,
} from "lucide-react";

import { Card } from "@/components/ui";
import SectionForm from "@/components/admin/pages/SectionForm";
import SectionList from "@/components/admin/pages/SectionList";
import DiffPanel from "@/components/admin/pages/DiffPanel";
import type { PageDoc } from "@/lib/pages/doc";
import {
  addSection,
  newSectionId,
  removeSection,
  reorderSections,
  toggleHidden as toggleHiddenIn,
  updateSettings,
  parseSlugList,
} from "@/lib/pages/edit";
import type { FieldDef } from "@/lib/pages/types";
import { bangkokInputToIso, bangkokLabel, isoToBangkokInput } from "@/lib/pages/bangkok-time";
import { PHASE_LABEL, PHASE_ORDER } from "@/lib/pages/campaign";
import { campaignPhaseAt, type CampaignPhase } from "@/lib/pages/doc";
import { PREVIEW_MESSAGE, type PreviewMessage } from "@/lib/pages/section-anchor";

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
  review: {
    state: "none" | "requested" | "approved" | "changes";
    note: string | null;
    by: string | null;
    at: string | null;
    decidedBy: string | null;
    decidedAt: string | null;
    reply: string | null;
  };
  campaign: {
    teaserAt: string | null;
    liveAt: string | null;
    extendedAt: string | null;
    endsAt: string | null;
    takeoverHome: boolean;
    brands: string[];
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
  brands: string;
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
  brands: "",
};

type SaveState = "idle" | "dirty" | "saving" | "saved" | "conflict" | "error";

/**
 * The three sizes the preview offers, as real devices rather than as
 * breakpoints.
 *
 * Widths are what the site is actually opened at — an iPhone 15 is 390pt
 * wide and an iPad Air is 820pt portrait — not the Tailwind breakpoints
 * either side of them. Previewing at exactly 768px would sit on the md
 * boundary and show whichever side of it the browser rounds to, which is the
 * one width worth never testing at.
 *
 * Phone and tablet carry their real screen height too, because the question
 * being asked of them is "what does someone see before scrolling". A desktop
 * has no single height, so it fills whatever space the editor has.
 */
const DEVICES = {
  mobile: { label: "มือถือ", width: 390, height: 844, fixedHeight: true },
  tablet: { label: "แท็บเล็ต", width: 820, height: 1180, fixedHeight: true },
  desktop: { label: "คอมพิวเตอร์", width: 1280, height: 0, fixedHeight: false },
  /** Whatever width the person typed. Three presets cover the usual
   *  questions; this covers the one they did not — "how does it look on the
   *  old iPad the shop uses at the counter", and every width in between. */
  custom: { label: "กำหนดเอง", width: 1024, height: 0, fixedHeight: false },
} as const;

type DeviceKey = keyof typeof DEVICES;

/** Widths worth one tap, from the real spread of devices on this shop. */
const WIDTH_PRESETS = [360, 414, 768, 1024, 1366, 1512, 1920];
const MIN_WIDTH = 280;
const MAX_WIDTH = 2560;

/** What the preview remembers between visits. Per browser, per person — a
 *  convenience, not state anything depends on, so localStorage is the right
 *  place and a failure to read it is simply the default. */
const PREVIEW_PREFS = "sl.pages.preview";

const STATUS_LABEL: Record<string, string> = {
  draft: "ร่าง",
  scheduled: "ตั้งเวลาไว้",
  published: "เผยแพร่แล้ว",
  ended: "จบแล้ว",
  archived: "เก็บเข้ากรุ",
};

/** Where this page lives on the site. In the toolbar because "which page am
 *  I editing" and "what is its address" are the same question to everybody
 *  except the database. */
function publicPathOf(kind: string, slug: string) {
  if (kind === "home") return "/";
  if (kind === "campaign") return `/sale/${slug}`;
  if (kind === "brand") return `/brands/${slug}`;
  return `/p/${slug}`;
}

const AUTOSAVE_MS = 1200;
/** How far back undo reaches. Deep enough to walk out of a wrong turn,
 *  shallow enough never to be why a tab feels heavy. */
const UNDO_DEPTH = 20;

export default function PageEditor(props: { params: Promise<{ kind: string; slug: string }> }) {
  const { kind, slug } = use(props.params);

  const [page, setPage] = useState<PageInfo | null>(null);
  const [doc, setDoc] = useState<PageDoc | null>(null);
  const [library, setLibrary] = useState<LibraryEntry[]>([]);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [issues, setIssues] = useState<string[]>([]);
  /** Warnings from the sections' own checks — "this product sold out", "no
   *  mobile banner". They need the catalogue and the database, so they can
   *  only come from the server. */
  const [sectionWarnings, setSectionWarnings] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{ by: string | null; at: string | null } | null>(null);
  const [adding, setAdding] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [device, setDevice] = useState<DeviceKey>("desktop");
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
  const [customWidth, setCustomWidth] = useState<number>(DEVICES.custom.width);
  /** The settings rail folds away when the preview needs the room. */
  const [railOpen, setRailOpen] = useState(true);
  /** "fit" shrinks to the space; a number is a fixed zoom the person chose. */
  const [zoom, setZoom] = useState<"fit" | number>("fit");
  const [expanded, setExpanded] = useState(false);
  /** Which half of the right rail is showing. Picking a section switches back
   *  to its settings by itself — having to click the tab after clicking the
   *  section would be two clicks for one intention. */
  const [rail, setRail] = useState<"section" | "page">("section");
  const [history, setHistory] = useState<PageDoc[]>([]);
  /** A thing that just happened and can be taken back, shown for a moment. */
  const [toast, setToast] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);
  const router = useRouter();
  const [publishAt, setPublishAt] = useState("");
  const [unpublishAt, setUnpublishAt] = useState("");

  // The version this editor read. Every save carries it, and the server
  // refuses a save that does not match — see saveDraft.
  const versionRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadTemplates = useCallback(async () => {
    try {
      // Scoped to this kind of page: a campaign template dropped onto a
      // plain page would bring sections that have no phase to read.
      const res = await fetch(`/api/admin/pages/templates?kind=${encodeURIComponent(kind)}`);
      const data = await res.json();
      if (res.ok && data.ok) setTemplates(data.templates);
    } catch {
      // A template list that failed to load is a missing convenience, not a
      // broken editor — the page itself is already on screen.
    }
  }, [kind]);

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
      setSectionWarnings(data.warnings ?? []);
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
              brands: (c.brands ?? []).join(", "),
            }
          : EMPTY_CAMPAIGN
      );
      setSaveState("idle");
      setConflict(null);
      // The document on screen was replaced by one from the server, so the
      // steps that led to the old one no longer lead anywhere.
      setHistory([]);
      setToast(null);
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
  /**
   * Every change goes through here, and every change is undoable.
   *
   * The stack holds documents, not operations: a document is the whole truth
   * about the page, so stepping back is one assignment and can never leave
   * the editor in a state no sequence of edits could have produced. Twenty
   * deep — enough to walk back out of a wrong turn, short enough that it is
   * never the reason a tab gets heavy.
   *
   * `remember: false` is how undo itself applies a document: without it,
   * undoing would push the thing being undone back onto the stack and the
   * two most recent states would swap for ever.
   */
  const edit = useCallback(
    (next: PageDoc, options?: { remember?: boolean }) => {
      if (options?.remember !== false) {
        setDoc((current) => {
          if (current) setHistory((past) => [...past, current].slice(-UNDO_DEPTH));
          return current;
        });
      }
      setDoc(next);
      if (saveState === "conflict") return;
      setSaveState("dirty");
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => void save(next), AUTOSAVE_MS);
    },
    [save, saveState]
  );

  const undo = useCallback(() => {
    setHistory((past) => {
      const previous = past[past.length - 1];
      if (!previous) return past;
      edit(previous, { remember: false });
      setToast(null);
      return past.slice(0, -1);
    });
  }, [edit]);

  // Esc leaves the expanded preview. Anything that covers the screen has to
  // have the key that every other overlay on this site answers to.
  useEffect(() => {
    if (!expanded) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setExpanded(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  /**
   * What the preview looked like last time.
   *
   * localStorage, because it is a per-person convenience and nothing depends
   * on it: a browser that refuses to store it simply opens on the defaults.
   * Every read and write is wrapped — a private window throws on access
   * rather than returning null.
   */
  /**
   * Writing must wait for reading, and the flag has to be state, not a ref.
   *
   * With a ref the writer still ran in the same commit as the reader — while
   * the restored values were only queued — so it saved the defaults over the
   * stored preferences. React then re-ran the reader (effects are invoked
   * twice in development), which read back the defaults it had just written
   * and applied those instead. The setting appeared not to persist at all.
   *
   * As state, the writer's first run is in the render *after* the restore
   * landed, so there is no window in which it can save the defaults.
   * Both versions were tried against a reload; only this one survives it.
   */
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  useEffect(() => {
    // Reading this during render instead would be a hydration mismatch: the
    // server has no localStorage, so its HTML would always carry the defaults
    // and the client's first render would not. An effect is the only correct
    // place, which is why the rule is turned off for these four lines.
    /* eslint-disable react-hooks/set-state-in-effect */
    try {
      const saved = JSON.parse(window.localStorage.getItem(PREVIEW_PREFS) ?? "null");
      // Note the shape of this: nothing returns early, because the flag at
      // the end has to be set even when there was nothing stored — otherwise
      // a browser opening the editor for the first time would never start
      // saving.
      if (saved && typeof saved === "object") {
        if (saved.device in DEVICES) setDevice(saved.device);
        if (Number.isFinite(saved.customWidth)) {
          setCustomWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(saved.customWidth))));
        }
        if (saved.zoom === "fit" || Number.isFinite(saved.zoom)) setZoom(saved.zoom);
        if (typeof saved.railOpen === "boolean") setRailOpen(saved.railOpen);
      }
    } catch {
      // No stored preference, or no storage at all. The defaults are fine.
    }
    setPrefsLoaded(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!prefsLoaded) return;
    try {
      window.localStorage.setItem(PREVIEW_PREFS, JSON.stringify({ device, customWidth, zoom, railOpen }));
    } catch {
      // Storage full or blocked; the editor works the same either way.
    }
  }, [prefsLoaded, device, customWidth, zoom, railOpen]);

  // Ctrl/Cmd+Z, except while typing. A text box has its own undo and taking
  // it over would mean a mistyped word costs you the last section you moved.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z" || event.shiftKey) return;
      // instanceof rather than a cast: a keydown delivered to the window
      // itself has the window as its target, which has no closest() — the
      // cast said otherwise and the handler threw before it ever undid
      // anything. Found by dispatching the shortcut in a test.
      const target = event.target;
      if (target instanceof Element && target.closest("input, textarea, select, [contenteditable='true']")) return;
      event.preventDefault();
      undo();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo]);

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

  function toggleHidden(id: string) {
    if (doc) edit(toggleHiddenIn(doc, id));
  }

  function remove(id: string) {
    if (!doc) return;
    const label = byType.get(doc.sections.find((s) => s.id === id)?.type ?? "")?.label;
    edit(removeSection(doc, id));
    if (selected === id) setSelected(null);
    // No confirmation dialog: deleting is cheap to undo and confirming every
    // delete teaches people to dismiss dialogs. The offer to take it back is
    // the safety, and it is one click rather than two.
    setToast(label ? `ลบ "${label}" แล้ว` : "ลบ section แล้ว");
  }

  function add(entry: LibraryEntry) {
    if (!doc) return;
    const id = newSectionId();
    edit(addSection(doc, entry, id));
    setSelected(id);
    setRail("section");
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

  async function requestReview() {
    setReviewBusy(true);
    setMessage(null);
    try {
      await flushDraft();
      const res = await fetch("/api/admin/page-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, slug, note: reviewNote }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error ?? "ขออนุมัติไม่สำเร็จ");
      setReviewNote("");
      // Says whether the ping actually went. "ส่งแล้ว" when nothing was sent
      // is how a request sits unseen for a day.
      setMessage(
        data.notified
          ? "ส่งคำขออนุมัติแล้ว และแจ้งทีมทาง LINE แล้ว"
          : "บันทึกคำขออนุมัติแล้ว — ยังไม่ได้ตั้งค่าแจ้งเตือน LINE จึงต้องบอกคนอนุมัติเอง"
      );
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "ขออนุมัติไม่สำเร็จ");
    } finally {
      setReviewBusy(false);
    }
  }

  async function decideReview(decision: "approved" | "changes") {
    setReviewBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/pages/${kind}/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "review-decision", decision, reply: reviewNote }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error ?? "บันทึกผลไม่สำเร็จ");
      setReviewNote("");
      setMessage(
        decision === "approved"
          ? `อนุมัติและเผยแพร่เป็นเวอร์ชัน ${data.number} แล้ว`
          : "ส่งกลับให้แก้แล้ว"
      );
      await load();
      setPreviewNonce((n) => n + 1);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "บันทึกผลไม่สำเร็จ");
    } finally {
      setReviewBusy(false);
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
          brands: parseSlugList(camp.brands),
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

  /** Things worth a second look that are not wrong.
   *
   *  Two sources, deliberately. The ones about the document itself are read
   *  off the document here, because seeing them should not cost a round trip.
   *  The ones about the world — a hand-picked product that sold out, a
   *  discount code that expired — can only come from the server, and arrive
   *  with the rest of the checklist. */
  const warnings = useMemo(() => {
    const out: string[] = [...sectionWarnings];
    const sections = doc?.sections ?? [];
    const hidden = sections.filter((s) => s.common?.hidden).length;
    if (hidden > 0) out.push(`มี section ที่ซ่อนอยู่ ${hidden} อัน — จะไม่ขึ้นบนหน้าจริง`);
    if (sections.length > 20) {
      out.push(`หน้านี้มี ${sections.length} section — เกิน 20 อันจะถูกตัดออกตอนแสดงผล`);
    }
    const scheduled = sections.filter((s) => s.common?.visibleFrom || s.common?.visibleUntil).length;
    if (scheduled > 0) out.push(`มี section ที่ตั้งเวลาไว้ ${scheduled} อัน — ตรวจวันเวลาอีกครั้ง`);
    return out;
  }, [doc, sectionWarnings]);

  const publicPath = publicPathOf(kind, slug);

  /**
   * The two halves of click-to-select.
   *
   * Incoming: the preview says which section was pressed, and it becomes the
   * selected one with its settings open — the same thing clicking the row in
   * the list does, which is the point: two ways in, one result.
   *
   * Outgoing: whatever is selected gets outlined in the frame, however it was
   * selected. Without that the editor would answer "which one is this?" only
   * when the answer came from the frame in the first place.
   *
   * Origin is checked on both sides. Both ends are served by this app, so the
   * test is an equality and anything else is dropped unread.
   */
  const previewFrameRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const data = event.data as PreviewMessage | undefined;
      if (data?.source !== PREVIEW_MESSAGE || data.type !== "select") return;
      setSelected(data.id);
      setRail("section");
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    const frame = previewFrameRef.current?.contentWindow;
    if (!frame) return;
    const message: PreviewMessage = { source: PREVIEW_MESSAGE, type: "highlight", id: selected };
    // A frame that has not finished loading drops this; the next selection
    // sends it again, and the frame outlines on its own click meanwhile.
    try {
      frame.postMessage(message, window.location.origin);
    } catch {
      // Cross-origin only happens if the preview is ever moved off this app.
    }
  }, [selected, previewNonce]);

  /**
   * The size to render the preview at, and how much to shrink it to fit.
   *
   * Desktop is drawn at the width the site is actually designed for and
   * scaled; a narrow iframe would make the page lay itself out as a tablet
   * and the preview would be of a layout nobody sees.
   *
   * Measured with a ResizeObserver *and* a window resize listener. The
   * observer alone is not enough here — it reports element size, and there
   * are reflows where the box ends up the same size for a different reason —
   * and this has bitten this codebase before with the sticky header height.
   */
  // A callback ref rather than useRef: this component returns early while it
  // is loading, so the preview box does not exist yet when a mount effect
  // runs — the effect would find null, give up, and never run again, leaving
  // the scale stuck at 1 and the frame overflowing its column.
  const [previewBox, setPreviewBox] = useState<HTMLDivElement | null>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = previewBox;
    if (!el) return;
    // minus the p-3 gutters on each side
    const measure = () => setBox({ width: el.clientWidth - 24, height: el.clientHeight - 24 });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, [previewBox]);

  const frame = useMemo(() => {
    const spec = DEVICES[device];
    const width = device === "custom" ? customWidth : spec.width;

    // Shrunk to fit in both directions, never enlarged: a phone frame blown
    // up to fill a wide column would be showing 390px of page at 200%, which
    // tells you nothing true about the phone.
    const byWidth = (box.width > 0 ? box.width : width) / width;
    const byHeight = spec.fixedHeight && box.height > 0 ? box.height / spec.height : Infinity;
    const fitted = Math.min(1, byWidth, byHeight);

    // "พอดีช่อง" is the default and the right answer most of the time. A
    // fixed zoom is for the other times: reading the small print at 100%, or
    // standing back from a long page at 50%. When it makes the frame wider
    // than the space, the space scrolls rather than the frame shrinking back
    // — otherwise the setting would quietly undo itself.
    const scale = zoom === "fit" ? fitted : zoom;

    const height = spec.fixedHeight
      ? spec.height
      : box.height > 0
        ? Math.round(box.height / scale)
        : 820;

    return { width, height, scale, fitted };
  }, [device, customWidth, zoom, box]);

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
    <div className="flex flex-col gap-3">
      {/* One bar instead of a page header, and it follows you down the page.
          The editor is the whole screen here, so the vertical space a normal
          admin header takes is space the preview wants — and "เผยแพร่" has to
          be reachable at the bottom of a long section list, not only at the
          top. */}
      <div className="sticky top-0 z-30 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl2 border border-surface-line bg-white/95 px-3 py-2.5 shadow-sm backdrop-blur">
        <Link
          href="/admin/pages"
          aria-label="กลับไปรายการหน้าเว็บ"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-surface-soft hover:text-brand-800"
        >
          <ArrowLeft size={17} />
        </Link>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-bold text-brand-ink">{page.title}</h1>
          <p className="truncate text-[11px] text-slate-500">
            <span className="font-semibold">{STATUS_LABEL[page.status] ?? page.status}</span> · {publicPath} · แก้ล่าสุดโดย{" "}
            {page.draftUpdatedBy ?? "—"}
          </p>
        </div>

        <SaveBadge state={saveState} />

        <button
          onClick={undo}
          disabled={history.length === 0}
          title="เลิกทำ (Ctrl+Z / Cmd+Z)"
          aria-label="เลิกทำ"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-surface-soft hover:text-brand-800 disabled:opacity-30"
        >
          <Undo2 size={17} />
        </button>

        <Link
          href={`/admin/pages/${kind}/${slug}/stats`}
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-slate-200 px-3.5 text-[13px] font-semibold text-brand-800"
        >
          <BarChart3 size={14} /> สถิติ
        </Link>
        <a
          href={publicPath}
          target="_blank"
          rel="noreferrer"
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-slate-200 px-3.5 text-[13px] font-semibold text-brand-800"
        >
          <ExternalLink size={14} /> ดูหน้าจริง
        </a>
        <button
          onClick={() => setConfirming(true)}
          disabled={publishing || saveState === "conflict"}
          className="flex h-10 shrink-0 items-center gap-2 rounded-full bg-brand-gradient px-5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {publishing ? <Loader2 size={15} className="animate-spin" /> : <Rocket size={15} />}
          เผยแพร่
        </button>
      </div>

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

      {toast && (
        /* Sits in the flow rather than floating over a corner: the editor is
           a working screen, and something that covers part of it to tell you
           what you already did is in the way. */
        <div className="flex flex-wrap items-center gap-3 rounded-xl2 border border-slate-200 bg-white px-4 py-2.5 text-sm text-brand-ink shadow-sm">
          <span className="min-w-0 flex-1">{toast}</span>
          <button
            onClick={undo}
            disabled={history.length === 0}
            className="flex h-9 items-center gap-1.5 rounded-full border border-slate-200 px-3.5 text-[13px] font-semibold text-brand-800 disabled:opacity-50"
          >
            <Undo2 size={13} /> เลิกทำ
          </button>
          <button
            onClick={() => setToast(null)}
            aria-label="ปิดข้อความนี้"
            className="grid h-9 w-9 place-items-center rounded-full text-slate-400 hover:text-brand-800"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {issues.length > 0 && (
        // Errors only. Warnings live in the publish dialog, where they are
        // read at the moment they matter — a permanent amber box above the
        // editor is a box that stops being read by Wednesday.
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

      {/* Three rails around a live preview — the arrangement every
          section-based editor converges on (Shopify, Wix, Squarespace,
          Webflow, Framer all do this): what the page is made of on the left,
          the page itself in the middle at the largest size the screen allows,
          and the settings for whatever is selected on the right.

          What changed from the first version: the preview used to be the
          *narrowest* column, squeezed between a 20rem list and a 22rem form,
          and the left rail also carried the schedule, the templates and the
          version history stacked underneath the sections, so the list of sections —
          the thing you came here to use — was a short window at the top of a
          very long column. Those panels now live behind a tab on the right,
          which is where this editor already had empty space. */}
      <div
        className={`grid gap-3 lg:grid-cols-[19rem_minmax(0,1fr)] ${
          railOpen ? "2xl:grid-cols-[19rem_minmax(0,1fr)_21rem]" : "2xl:grid-cols-[19rem_minmax(0,1fr)]"
        }`}
      >
        {/* Left: what the page is made of, and nothing else. Sticky and
            scrolling on its own so a twenty-section page does not push the
            preview off the screen. */}
        <Card padded={false} className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
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

          <SectionList
            sections={doc.sections}
            byType={byType}
            selected={selected}
            onSelect={(id) => {
              setSelected(id);
              setRail("section");
            }}
            onReorder={(from, to) => edit(reorderSections(doc, from, to))}
            onToggleHidden={toggleHidden}
            onRemove={remove}
          />
        </Card>

        {/* Expanded, the preview leaves the grid and takes the window. Fixed
            rather than full-screen API: the editor's own toolbar stays
            reachable above it, and Esc closes it the way every overlay on
            this site does. */}
        <Card
          padded={false}
          className={
            expanded
              ? "fixed inset-3 z-50 flex flex-col overflow-hidden shadow-xl"
              : "overflow-hidden"
          }
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
              <h2 className="text-sm font-bold text-brand-ink">ตัวอย่างร่าง</h2>

              {/* The width is a field, not a readout. Three presets answer the
                  usual questions; the shop also gets visitors on an 820 tablet
                  at the counter and a 1920 monitor in the office, and before
                  this there was no way to look at either. */}
              <label className="flex items-center gap-1 text-[11px] text-slate-400">
                <input
                  type="number"
                  value={frame.width}
                  min={MIN_WIDTH}
                  max={MAX_WIDTH}
                  step={10}
                  aria-label="ความกว้างของหน้าจอที่จะดู (พิกเซล)"
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    if (!Number.isFinite(next)) return;
                    setDevice("custom");
                    setCustomWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(next))));
                  }}
                  list="preview-widths"
                  className="h-8 w-20 rounded-md border border-slate-200 px-1.5 text-center font-mono text-[12px] text-brand-ink outline-hidden focus-visible:border-brand-teal"
                />
                px
              </label>
              <datalist id="preview-widths">
                {WIDTH_PRESETS.map((w) => (
                  <option key={w} value={w} />
                ))}
              </datalist>

              <label className="flex items-center gap-1 text-[11px] text-slate-400">
                {/* appearance-none and w-auto: a native select is as wide as
                    its longest option plus room for the system arrow, so this
                    one sat in a box far wider than the words inside it. With
                    the chrome off it is the width of what it says. */}
                <select
                  value={zoom === "fit" ? "fit" : String(zoom)}
                  onChange={(e) => setZoom(e.target.value === "fit" ? "fit" : Number(e.target.value))}
                  aria-label="ขนาดที่แสดง"
                  className="h-8 w-auto appearance-none rounded-md border border-slate-200 px-2 text-center text-[12px] text-brand-ink outline-hidden hover:border-slate-300 focus-visible:border-brand-teal"
                >
                  <option value="fit">พอดี {Math.round(frame.fitted * 100)}%</option>
                  {[0.5, 0.75, 1].map((z) => (
                    <option key={z} value={z}>
                      {z * 100}%
                    </option>
                  ))}
                </select>
              </label>

              {DEVICES[device].fixedHeight && (
                <span className="font-mono text-[11px] text-slate-400">สูง {frame.height}</span>
              )}
            </div>
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
              {(Object.keys(DEVICES) as DeviceKey[]).map((key) => {
                const on = device === key;
                const Icon = key === "mobile" ? Smartphone : key === "tablet" ? Tablet : Monitor;
                return (
                  <button
                    key={key}
                    onClick={() => setDevice(key)}
                    aria-pressed={on}
                    aria-label={`ดูแบบ${DEVICES[key].label}`}
                    title={`${DEVICES[key].label} · ${DEVICES[key].width}px`}
                    className={`grid h-10 w-10 place-items-center rounded-lg ${
                      on ? "bg-brand-gradient-soft text-brand-800" : "text-slate-400 hover:text-brand-800"
                    }`}
                  >
                    <Icon size={16} />
                  </button>
                );
              })}
              <button
                onClick={() => setExpanded((v) => !v)}
                aria-pressed={expanded}
                aria-label={expanded ? "ย่อกรอบตัวอย่างกลับ" : "ขยายกรอบตัวอย่างเต็มจอ"}
                title={expanded ? "ย่อกลับ (Esc)" : "ขยายเต็มจอ"}
                className="grid h-10 w-10 place-items-center rounded-lg text-slate-400 hover:text-brand-800"
              >
                {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
              <button
                onClick={() => setRailOpen((v) => !v)}
                aria-pressed={!railOpen}
                aria-label={railOpen ? "ซ่อนแผงตั้งค่าทางขวา" : "แสดงแผงตั้งค่าทางขวา"}
                title={railOpen ? "ซ่อนแผงขวา" : "แสดงแผงขวา"}
                className="hidden h-10 w-10 place-items-center rounded-lg text-slate-400 hover:text-brand-800 2xl:grid"
              >
                {railOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
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
          <div
            ref={setPreviewBox}
            className={`flex justify-center bg-slate-100 p-3 ${
              expanded ? "min-h-0 flex-1 overflow-auto" : "h-[calc(100vh-11rem)] min-h-[32rem] overflow-hidden"
            } ${zoom === "fit" ? "" : "overflow-auto"}`}
          >
            {/* The frame renders the saved draft, so it is one save behind
                whatever is being typed. The badge in the toolbar says when
                that save happened; without it a stale frame reads as the
                editor having lost the edit.

                Tall by default: this is the page, and the question being
                asked of it is almost always "how does it read as you scroll",
                which a 70vh letterbox answers badly. */}
            {/* Rendered at a real desktop width and scaled down to fit, not
                rendered narrow. A 740px-wide frame makes the site lay itself
                out as a tablet, so "ดูแบบคอมพิวเตอร์" would have been showing
                a layout no desktop visitor ever sees — the one thing a
                preview must not do. The phone size needs no scaling: 390px
                fits as it is, at 1:1. */}
            <div
              style={{
                width: frame.width * frame.scale,
                height: frame.height * frame.scale,
              }}
              className="relative"
            >
              <iframe
                key={previewNonce}
                ref={previewFrameRef}
                src={`/pages-preview/${kind}/${slug}?v=${previewNonce}${
                  kind === "campaign" && previewPhase !== "now" ? `&phase=${previewPhase}` : ""
                }`}
                title="ตัวอย่างร่างของหน้านี้"
                className="rounded-lg border border-slate-200 bg-white"
                style={{
                  width: frame.width,
                  height: frame.height,
                  transform: `scale(${frame.scale})`,
                  transformOrigin: "top left",
                }}
              />
            </div>
          </div>
        </Card>

        {/* Right: one rail, two things. The settings of the selected section
            is what you want ninety percent of the time; everything about the
            page as a whole — when it goes live, templates, versions — is a
            tab away rather than a scroll away. */}
        {/* Below 2xl this drops under the preview and runs the full width,
            rather than becoming a third column. Measured at a 1280px window:
            three columns left the preview 356px wide, which scales the page
            to a quarter size — a preview you cannot read is not a preview. */}
        <Card
          padded={false}
          className={`lg:col-span-2 2xl:col-span-1 2xl:sticky 2xl:top-20 2xl:max-h-[calc(100vh-7rem)] 2xl:overflow-y-auto ${
            railOpen ? "" : "2xl:hidden"
          }`}
        >
          <div role="tablist" aria-label="แผงตั้งค่า" className="flex border-b border-slate-100">
            {(
              [
                ["section", current && currentDef ? currentDef.label : "section ที่เลือก"],
                ["page", "ตั้งค่าเพจ"],
              ] as const
            ).map(([key, label]) => {
              const on = rail === key;
              return (
                <button
                  key={key}
                  role="tab"
                  aria-selected={on}
                  onClick={() => setRail(key)}
                  className={`min-w-0 flex-1 truncate border-b-2 px-3 py-3 text-[13px] font-semibold transition-colors ${
                    on ? "border-brand-teal text-brand-800" : "border-transparent text-slate-500 hover:text-brand-800"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {rail === "section" ? (
            <div className="p-4">
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
            </div>
          ) : (
            <div className="flex flex-col">
          {/* Five things used to sit here in a row, all looking alike, in a
              rail as wide as a phone. Named and folded instead: the titles
              answer "what can I do here" at a glance, and opening one is a
              click — less work than scrolling past four panels you did not
              want. Ordered by how often each is reached for.

              <details> rather than a toggle of our own: it opens without
              JavaScript, it is a disclosure in the accessibility tree with
              no aria- attributes to get wrong, and find-in-page opens it to
              show a match. */}
          {/* Open to begin with: "what is different from what customers
              see" is the question you arrive with. */}
          <details open className="border-t border-slate-100">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 hover:bg-surface-soft">
              <span className="text-[13px] font-semibold text-brand-ink">สรุปสิ่งที่แก้ไว้</span>
              <span className="shrink-0 text-[11px] text-slate-400">เทียบกับหน้าจริง</span>
            </summary>
            <div className="px-4 pb-3">
              <DiffPanel kind={kind} slug={slug} from="published" title="ร่างนี้ต่างจากหน้าจริงตรงไหน" />
            </div>
          </details>

          {/* The hand-off. Everyone who can open this screen can ask for a
              look; only the publish button beside it decides whether they
              can also act on the answer, and that gate is the permission
              system's, not this panel's. */}
          <details className="border-t border-slate-100">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 hover:bg-surface-soft">
              <span className="text-[13px] font-semibold text-brand-ink">ขออนุมัติก่อนเผยแพร่</span>
              <span className="shrink-0 text-[11px] text-slate-400">สำหรับคนที่เผยแพร่เองไม่ได้</span>
            </summary>
            <div className="px-4 pb-3">

            {page.review.state === "requested" ? (
              <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] leading-relaxed text-amber-900">
                <p className="font-semibold">รออนุมัติอยู่</p>
                <p className="mt-0.5">
                  ขอโดย {page.review.by ?? "—"}
                  {page.review.at ? ` · ${bangkokLabel(page.review.at)}` : ""}
                </p>
                {page.review.note && <p className="mt-1">หมายเหตุ: {page.review.note}</p>}
            {/* Approving without being shown what is in it is a rubber
                    stamp with a person attached. */}
                <div className="mt-2 border-t border-amber-200 pt-2">
                  <DiffPanel kind={kind} slug={slug} from="published" title="สิ่งที่จะเปลี่ยนถ้าอนุมัติ" />
                </div>
              </div>
            ) : page.review.state === "changes" ? (
              <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-[12px] leading-relaxed text-rose-800">
                <p className="font-semibold">ถูกส่งกลับให้แก้</p>
                <p className="mt-0.5">
                  โดย {page.review.decidedBy ?? "—"}
                  {page.review.decidedAt ? ` · ${bangkokLabel(page.review.decidedAt)}` : ""}
                </p>
                {page.review.reply && <p className="mt-1">สิ่งที่ต้องแก้: {page.review.reply}</p>}
              </div>
            ) : page.review.state === "approved" ? (
              <p className="mt-2 text-[12px] leading-relaxed text-brand-800">
                อนุมัติแล้วโดย {page.review.decidedBy ?? "—"}
                {page.review.decidedAt ? ` · ${bangkokLabel(page.review.decidedAt)}` : ""}
              </p>
            ) : (
              <p className="mt-2 text-[12px] leading-relaxed text-slate-400">ยังไม่ได้ขออนุมัติสำหรับร่างนี้</p>
            )}

            <textarea
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder={
                page.review.state === "requested"
                  ? "สิ่งที่อยากให้แก้ (ถ้าส่งกลับ)…"
                  : "บอกคนอนุมัติว่าแก้อะไรไป (ไม่บังคับ)…"
              }
              aria-label="ข้อความถึงคนอนุมัติ"
              className="mt-2 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-[13px] leading-relaxed outline-hidden focus-visible:border-brand-teal"
            />

            <div className="mt-2 flex flex-wrap gap-2">
              <button
                onClick={() => void requestReview()}
                disabled={reviewBusy || saveState === "conflict"}
                className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full border border-slate-200 text-[13px] font-semibold text-brand-800 disabled:opacity-60"
              >
                {reviewBusy ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                ขออนุมัติ
              </button>
              {page.review.state === "requested" && (
                <>
                  <button
                    onClick={() => void decideReview("approved")}
                    disabled={reviewBusy || issues.length > 0 || saveState === "dirty"}
                    title={issues.length > 0 ? "ยังมีข้อที่ต้องแก้ก่อนเผยแพร่" : undefined}
                    className="flex h-10 items-center justify-center gap-1.5 rounded-full bg-brand-gradient px-4 text-[13px] font-semibold text-white disabled:opacity-50"
                  >
                    <Check size={13} /> อนุมัติและเผยแพร่
                  </button>
                  <button
                    onClick={() => void decideReview("changes")}
                    disabled={reviewBusy}
                    className="h-10 rounded-full border border-slate-200 px-4 text-[13px] font-semibold text-slate-600 disabled:opacity-60"
                  >
                    ส่งกลับให้แก้
                  </button>
                </>
              )}
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
              ปุ่มอนุมัติขึ้นเฉพาะตอนมีคำขอค้างอยู่ · คนที่ไม่มีสิทธิ์เผยแพร่จะกดอนุมัติไม่ได้ ระบบจะปฏิเสธที่ฝั่งเซิร์ฟเวอร์
            </p>
          </div>
            </details>

          {/* Scheduling. Deliberately under the section list rather than in
              the publish dialog: a time set on a page is a property of the
              page, not of the one press of a button, and burying it in a
              dialog is how it gets set once and then forgotten about. */}
          <details className="border-t border-slate-100">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 hover:bg-surface-soft">
              <span className="text-[13px] font-semibold text-brand-ink">ตั้งเวลาเผยแพร่</span>
              <span className="shrink-0 text-[11px] text-slate-400">เวลาไทย</span>
            </summary>
            <div className="px-4 pb-3">
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
            </details>

          {kind === "campaign" && (
            /* A campaign's own settings: when it runs, what colour it is, and
               whether it takes over the home page. Together with the phase
               switcher over the preview, this is the whole of what makes a
               campaign page different from any other page. */
            <details className="border-t border-slate-100">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 hover:bg-surface-soft">
              <span className="text-[13px] font-semibold text-brand-ink">ช่วงเวลาและสีของแคมเปญ</span>
              <span className="shrink-0 text-[11px] text-slate-400">เฉพาะเพจแคมเปญ</span>
            </summary>
            <div className="px-4 pb-3">
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

              <label className="mt-3 block text-[12px] text-slate-500">
                แบรนด์ที่ร่วมแคมเปญ
                <input
                  value={camp.brands}
                  onChange={(e) => setCamp((c) => ({ ...c, brands: e.target.value }))}
                  placeholder="smooth-e, dentiste"
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-2.5 text-[13px] outline-hidden focus-visible:border-brand-teal"
                />
                {/* Why this is worth filling in, since nothing on this page
                    changes when you do. */}
                <span className="mt-1 block text-[11px] leading-relaxed text-slate-400">
                  หน้าของแบรนด์เหล่านี้จะขึ้นแถบ &quot;กำลังมีแคมเปญ&quot; ให้เอง · ใส่ slug คั่นด้วยจุลภาค ·
                  ชื่อที่ไม่มีในร้านจะถูกตัดออกตอนบันทึก
                </span>
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
            </details>
          )}

          {/* Templates and copies. A template is an arrangement of sections
              with the ids stripped; applying one replaces the draft and
              leaves the published page alone, which is why it needs no
              scarier warning than the one on the button. */}
          <details className="border-t border-slate-100">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 hover:bg-surface-soft">
              <span className="text-[13px] font-semibold text-brand-ink">template และทำสำเนา</span>
              <span className="shrink-0 text-[11px] text-slate-400">ใช้โครงหน้านี้ซ้ำ</span>
            </summary>
            <div className="px-4 pb-3">

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
            </details>

          {revisions.length > 0 && (
            <details className="border-t border-slate-100">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 hover:bg-surface-soft">
              <span className="text-[13px] font-semibold text-brand-ink">เวอร์ชันที่เผยแพร่แล้ว</span>
              <span className="shrink-0 text-[11px] text-slate-400">ย้อนกลับได้</span>
            </summary>
            <div className="px-4 pb-3">
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
            </details>
          )}
            </div>
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
