"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, FileText, Home, Loader2, Plus } from "lucide-react";

import { PageHeader } from "@/components/admin/layout-kit";
import { Card } from "@/components/ui";

// Every page the team can edit, and the button that makes another one.
//
// The home page is here whether or not a row exists for it yet — it is seeded
// the first time somebody opens it, so listing it only after that would hide
// the one page everybody wants on the day the feature ships.

type PageRow = {
  id: string;
  kind: string;
  slug: string;
  title: string;
  status: string;
  draft_updated_at: string;
  published_revision_id: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  draft: "ร่าง",
  scheduled: "ตั้งเวลาไว้",
  published: "เผยแพร่แล้ว",
  ended: "จบแล้ว",
  archived: "เก็บเข้ากรุ",
};

/** Where a page of each kind actually lives. The list shows it so nobody has
 *  to remember that campaigns are under /sale and everything else is not. */
function addressOf(page: { kind: string; slug: string }) {
  if (page.kind === "home") return "/";
  if (page.kind === "campaign") return `/sale/${page.slug}`;
  if (page.kind === "brand") return `/brands/${page.slug}`;
  return `/p/${page.slug}`;
}

const NEW_KINDS: [string, string, string][] = [
  ["page", "หน้าเว็บ", "/p/"],
  ["campaign", "แคมเปญ", "/sale/"],
];

export default function AdminPagesIndex() {
  const [pages, setPages] = useState<PageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [kind, setKind] = useState("page");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/pages");
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error ?? "โหลดรายการหน้าไม่สำเร็จ");
      setPages(data.pages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดรายการหน้าไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, slug, kind }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error ?? "สร้างหน้าไม่สำเร็จ");
      setAdding(false);
      setTitle("");
      setSlug("");
      setKind("page");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "สร้างหน้าไม่สำเร็จ");
    } finally {
      setCreating(false);
    }
  }

  const hasHome = pages.some((p) => p.kind === "home");

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="หน้าเว็บ"
        subtitle="ประกอบหน้าจาก section ที่เลือกได้ · แก้เป็นร่างก่อน แล้วค่อยเผยแพร่"
        actions={
          <>
            <Link
              href="/admin/pages/help"
              className="flex h-11 items-center gap-2 rounded-full border border-slate-200 px-4 text-sm font-semibold text-brand-800"
            >
              <BookOpen size={15} /> วิธีใช้
            </Link>
          <button
            onClick={() => setAdding((v) => !v)}
            className="flex h-11 items-center gap-2 rounded-full border border-slate-200 px-4 text-sm font-semibold text-brand-800"
          >
            <Plus size={15} /> สร้างหน้าใหม่
          </button>
          </>
        }
      />

      {adding && (
        <Card>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="sm:w-36">
              <span className="block text-[13px] font-semibold text-brand-ink">ประเภท</span>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value)}
                className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-2.5 text-sm outline-hidden focus-visible:border-brand-teal focus-visible:ring-2 focus-visible:ring-brand-teal/30"
              >
                {NEW_KINDS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex-1">
              <span className="block text-[13px] font-semibold text-brand-ink">ชื่อหน้า</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={kind === "campaign" ? "เช่น 11.11 Mega Sale" : "เช่น เกี่ยวกับเรา"}
                className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-hidden focus-visible:border-brand-teal focus-visible:ring-2 focus-visible:ring-brand-teal/30"
              />
            </label>
            <label className="flex-1">
              <span className="block text-[13px] font-semibold text-brand-ink">ที่อยู่หน้า</span>
              <span className="mt-1.5 flex h-11 items-center rounded-lg border border-slate-200 pl-3">
                <span className="text-sm text-slate-400">
                  {NEW_KINDS.find(([value]) => value === kind)?.[2] ?? "/p/"}
                </span>
                <input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder={kind === "campaign" ? "11-11" : "about-us"}
                  className="h-full flex-1 rounded-r-lg px-1 text-sm outline-hidden"
                />
              </span>
            </label>
            <button
              onClick={create}
              disabled={creating || !title.trim() || !slug.trim()}
              className="flex h-11 items-center gap-2 rounded-full bg-brand-gradient px-5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {creating && <Loader2 size={15} className="animate-spin" />} สร้าง
            </button>
          </div>
          <p className="mt-2 text-[12px] text-slate-500">
            ที่อยู่ใช้ได้เฉพาะ a-z, 0-9 และขีดกลาง · เปลี่ยนทีหลังไม่ได้ เพราะลิงก์ที่แชร์ไปแล้วจะเสีย
            {kind === "campaign" && " · แคมเปญประจำปีให้ใช้ที่อยู่เดิมทุกปี (เช่น 11-11) แล้วทำซ้ำจากของปีที่แล้ว ลิงก์โฆษณาเก่าและอันดับใน Google จะไม่หาย"}
          </p>
        </Card>
      )}

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <Card padded={false}>
        {loading ? (
          <p className="px-4 py-10 text-center text-sm text-slate-500">กำลังโหลด…</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {!hasHome && (
              // Seeded on first open — listed before that so the one page
              // everybody wants is not missing on day one.
              <li>
                <Link
                  href="/admin/pages/home/home"
                  className="flex items-center gap-3.5 px-4 py-4 transition-colors hover:bg-surface-soft"
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-gradient-soft text-brand-800">
                    <Home size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-brand-ink">หน้าแรก</span>
                    <span className="block text-[12px] text-slate-500">เปิดครั้งแรกเพื่อเริ่มแก้ไขได้</span>
                  </span>
                  <span className="shrink-0 text-[12px] text-slate-400">/</span>
                </Link>
              </li>
            )}
            {pages.map((page) => (
              <li key={page.id}>
                <Link
                  href={`/admin/pages/${page.kind}/${page.slug}`}
                  className="flex items-center gap-3.5 px-4 py-4 transition-colors hover:bg-surface-soft"
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-gradient-soft text-brand-800">
                    {page.kind === "home" ? <Home size={18} /> : <FileText size={18} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-brand-ink">{page.title}</span>
                    <span className="block text-[12px] text-slate-500">
                      {STATUS_LABEL[page.status] ?? page.status} · แก้ล่าสุด{" "}
                      {new Date(page.draft_updated_at).toLocaleString("th-TH")}
                    </span>
                  </span>
                  <span className="shrink-0 text-[12px] text-slate-400">{addressOf(page)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="flex items-start gap-2 text-[13px] leading-relaxed text-slate-500">
        <FileText size={15} className="mt-0.5 shrink-0" />
        หน้าที่ยังไม่เผยแพร่จะยังเปิดไม่ได้จากข้างนอก — คนที่กดลิงก์จะเจอหน้า 404 ไม่ใช่หน้าเปล่า
      </p>
    </div>
  );
}
