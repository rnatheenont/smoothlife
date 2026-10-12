"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  Rocket,
  Trash2,
  TriangleAlert,
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

  // The version this editor read. Every save carries it, and the server
  // refuses a save that does not match — see saveDraft.
  const versionRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      setSaveState("idle");
      setConflict(null);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "โหลดเพจไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [kind, slug]);

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

  async function publishNow() {
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
              onClick={publishNow}
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

      <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
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

          {revisions.length > 0 && (
            <div className="border-t border-slate-100 px-4 py-3">
              <h3 className="text-[12px] font-bold text-slate-500">เวอร์ชันที่เผยแพร่แล้ว</h3>
              <ul className="mt-2 flex flex-col gap-1">
                {revisions.slice(0, 5).map((r) => (
                  <li key={r.id} className="text-[12px] text-slate-500">
                    #{r.number} · {new Date(r.published_at).toLocaleString("th-TH")} · {r.published_by ?? "—"}
                    {r.id === page.publishedRevisionId && (
                      <span className="ml-1 font-semibold text-brand-800">(ใช้อยู่)</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
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
