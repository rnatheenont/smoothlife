"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowUp, ExternalLink, Eye, LayoutTemplate, Loader2, Plus, RotateCcw, Trash2 } from "lucide-react";

import { PageHeader } from "@/components/admin/layout-kit";
import { Card } from "@/components/ui";
import ImagePicker from "@/components/admin/pages/ImagePicker";

// One brand's profile: the parts of its page the catalogue cannot write.
//
// There is no draft here, on purpose. A profile is four small things, and
// the brand page reads them live — so the save button says that it publishes,
// and the permission behind it is the publish permission. Laying the page
// out differently is a separate, drafted job in the page editor, linked from
// the bottom of this screen.

type Usp = { title: string; text: string };
type Profile = {
  hero_image: string;
  hero_image_mobile: string;
  hero_alt: string;
  story: string;
  usp: Usp[];
  featured_slugs: string[];
};
type ProductOption = { slug: string; name: string; image: string; inStock: boolean; reviewCount: number };

const EMPTY: Profile = { hero_image: "", hero_image_mobile: "", hero_alt: "", story: "", usp: [], featured_slugs: [] };
const USP_MAX = 4;
const FEATURED_MAX = 10;
const STORY_MAX = 1500;

const inputClass =
  "mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-hidden focus-visible:border-brand-teal focus-visible:ring-2 focus-visible:ring-brand-teal/30";

function Label({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <span className="block">
      <span className="block text-[13px] font-semibold text-brand-ink">{children}</span>
      {hint && <span className="mt-0.5 block text-[12px] text-slate-500">{hint}</span>}
    </span>
  );
}

export default function BrandProfileEditor(props: { params: Promise<{ slug: string }> }) {
  const { slug } = use(props.params);

  const [brand, setBrand] = useState<{ name: string; logo: string; tagline: string } | null>(null);
  const [profile, setProfile] = useState<Profile>(EMPTY);
  const [saved, setSaved] = useState<Profile>(EMPTY);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [page, setPage] = useState<{ status: string } | null>(null);
  const [liveOnSite, setLiveOnSite] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [productQuery, setProductQuery] = useState("");
  const [previewing, setPreviewing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/brands/${slug}`);
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error ?? "โหลดข้อมูลแบรนด์ไม่สำเร็จ");
      setBrand(data.brand);
      const p: Profile = data.profile
        ? {
            hero_image: data.profile.hero_image ?? "",
            hero_image_mobile: data.profile.hero_image_mobile ?? "",
            hero_alt: data.profile.hero_alt ?? "",
            story: data.profile.story ?? "",
            usp: Array.isArray(data.profile.usp) ? data.profile.usp : [],
            featured_slugs: data.profile.featured_slugs ?? [],
          }
        : EMPTY;
      setProfile(p);
      setSaved(p);
      setProducts(data.products);
      setPage(data.page);
      setLiveOnSite(Boolean(data.liveOnSite));
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "โหลดข้อมูลแบรนด์ไม่สำเร็จ" });
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = JSON.stringify(profile) !== JSON.stringify(saved);

  // Leaving with unsaved changes asks first — the same courtesy the page
  // editor gives, for the same reason.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const problems = useMemo(() => {
    const out: string[] = [];
    if (profile.hero_image && !profile.hero_alt.trim()) out.push("ใส่คำบรรยายรูปหัว (alt) ก่อนบันทึก");
    if (profile.hero_image_mobile && !profile.hero_image) out.push("รูปมือถือต้องมีรูปหลักคู่กัน");
    if (profile.usp.some((u) => !u.title.trim())) out.push("จุดเด่นทุกข้อต้องมีหัวข้อ");
    if (profile.story.length > STORY_MAX) out.push(`เรื่องราวยาวเกิน ${STORY_MAX} ตัวอักษร`);
    return out;
  }, [profile]);

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/brands/${slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...profile, usp: profile.usp.map((u) => ({ title: u.title.trim(), text: u.text.trim() })) }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error ?? "บันทึกไม่สำเร็จ");
      setSaved(profile);
      setMessage({ tone: "ok", text: liveOnSite ? "บันทึกแล้ว — ขึ้นบนหน้าแบรนด์แล้ว" : "บันทึกแล้ว" });
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "บันทึกไม่สำเร็จ" });
    } finally {
      setSaving(false);
    }
  }

  /**
   * Park what is on screen and open it in the preview.
   *
   * The form is sent as it stands, unsaved and possibly incomplete — that is
   * the state worth looking at. A new tab rather than this one, because the
   * thing being previewed is still in the form behind it.
   */
  async function preview() {
    setPreviewing(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/brand-profile-draft", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, profile }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error ?? "เปิดตัวอย่างไม่สำเร็จ");
      window.open(`/pages-preview/brand/${slug}?profile=draft&v=${Date.now()}`, "_blank", "noopener");
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "เปิดตัวอย่างไม่สำเร็จ" });
    } finally {
      setPreviewing(false);
    }
  }

  async function useAuto() {
    if (!window.confirm("หยุดใช้หน้าที่จัดเอง แล้วกลับไปใช้หน้าอัตโนมัติ?\nหน้าที่จัดไว้ยังเก็บอยู่ กลับมาแก้ต่อได้จากเมนูหน้าเว็บ")) return;
    setMessage(null);
    const res = await fetch(`/api/admin/brands/${slug}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "use-auto" }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      setMessage({ tone: "error", text: data?.error ?? "เปลี่ยนไม่สำเร็จ" });
      return;
    }
    setMessage({ tone: "ok", text: "กลับไปใช้หน้าอัตโนมัติแล้ว" });
    await load();
  }

  const set = <K extends keyof Profile>(key: K, value: Profile[K]) => setProfile((p) => ({ ...p, [key]: value }));

  const setUsp = (index: number, patch: Partial<Usp>) =>
    set("usp", profile.usp.map((u, i) => (i === index ? { ...u, ...patch } : u)));

  const move = <T,>(list: T[], from: number, to: number): T[] => {
    if (to < 0 || to >= list.length) return list;
    const next = [...list];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
  };

  const productBySlug = useMemo(() => new Map(products.map((p) => [p.slug, p])), [products]);
  const pickable = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    return products
      .filter((p) => !profile.featured_slugs.includes(p.slug))
      .filter((p) => !q || p.name.toLowerCase().includes(q))
      .slice(0, 30);
  }, [products, profile.featured_slugs, productQuery]);

  if (loading) {
    return (
      <p className="flex items-center gap-2 py-10 text-sm text-slate-500">
        <Loader2 size={16} className="animate-spin" /> กำลังโหลด…
      </p>
    );
  }
  if (!brand) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-rose-600">{message?.text ?? "ไม่พบแบรนด์นี้"}</p>
        <Link href="/admin/brands" className="text-sm font-semibold text-brand-800">
          ← กลับไปรายชื่อแบรนด์
        </Link>
      </div>
    );
  }

  const customLive = page?.status === "published";

  return (
    <div className="flex flex-col gap-5">
      <Link href="/admin/brands" className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-brand-800">
        <ArrowLeft size={15} /> รายชื่อแบรนด์
      </Link>

      <PageHeader
        title={brand.name}
        subtitle="ข้อมูลส่วนนี้ขึ้นบนหน้าแบรนด์ทันทีที่บันทึก ทั้งหน้าอัตโนมัติและหน้าที่จัดเอง · กด &quot;ดูตัวอย่างก่อนบันทึก&quot; เพื่อดูผลก่อน"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => void preview()}
              disabled={previewing}
              className="flex h-11 items-center gap-2 rounded-full border border-slate-200 px-4 text-sm font-semibold text-brand-800 disabled:opacity-60"
            >
              {previewing ? <Loader2 size={15} className="animate-spin" /> : <Eye size={15} />}
              ดูตัวอย่างก่อนบันทึก
            </button>
            <a
              href={`/brands/${slug}`}
              target="_blank"
              rel="noreferrer"
              className="flex h-11 items-center gap-2 rounded-full border border-slate-200 px-4 text-sm font-semibold text-brand-800"
            >
              <ExternalLink size={15} /> ดูหน้าแบรนด์
            </a>
          </div>
        }
      />

      {!liveOnSite && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] leading-relaxed text-amber-900">
          หน้าแบรนด์บนเว็บจริงยังใช้แบบเดิมอยู่ — บันทึกไว้ได้เลย จะขึ้นบนเว็บเมื่อทีมเปิดใช้ระบบหน้าแบรนด์ใหม่
        </p>
      )}

      {/* Hero picture */}
      <Card>
        <h2 className="text-base font-bold text-brand-ink">รูปหัวหน้าแบรนด์</h2>
        <p className="mt-1 text-[12px] text-slate-500">
          แสดงเหนือการ์ดชื่อแบรนด์ · ไม่ใส่ = หน้าแบรนด์แบบเดิม (การ์ดโลโก้อย่างเดียว)
        </p>
        <div className="mt-4 grid gap-5 md:grid-cols-2">
          <div>
            <Label hint="แนะนำ 1600×560 px (สัดส่วน 20:7)">รูปจอคอม</Label>
            <div className="mt-1.5">
              <ImagePicker
                value={profile.hero_image}
                onChange={(url) => set("hero_image", url)}
                onPickAlt={(alt) => !profile.hero_alt && alt && set("hero_alt", alt)}
              />
            </div>
          </div>
          <div>
            <Label hint="แนะนำ 1080×1350 px (สัดส่วน 4:5) · ไม่ใส่ = ใช้รูปจอคอม">รูปมือถือ (ไม่บังคับ)</Label>
            <div className="mt-1.5">
              <ImagePicker value={profile.hero_image_mobile} onChange={(url) => set("hero_image_mobile", url)} />
            </div>
          </div>
        </div>
        <label className="mt-4 block">
          <Label hint="บอกว่าในรูปมีอะไร สำหรับคนที่ใช้โปรแกรมอ่านหน้าจอ">คำบรรยายรูป (alt)</Label>
          <input
            value={profile.hero_alt}
            onChange={(e) => set("hero_alt", e.target.value)}
            maxLength={200}
            placeholder={`เช่น ผลิตภัณฑ์ ${brand.name} วางบนโต๊ะ`}
            className={inputClass}
          />
        </label>
      </Card>

      {/* Story */}
      <Card>
        <h2 className="text-base font-bold text-brand-ink">เรื่องราวแบรนด์</h2>
        <label className="mt-3 block">
          <Label hint="ตัวหนา **ข้อความ** · ตัวเอียง *ข้อความ* · รายการ ขึ้นบรรทัดด้วย - ">ข้อความแนะนำแบรนด์</Label>
          <textarea
            value={profile.story}
            onChange={(e) => set("story", e.target.value)}
            rows={6}
            className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm leading-relaxed outline-hidden focus-visible:border-brand-teal focus-visible:ring-2 focus-visible:ring-brand-teal/30"
          />
          <span className={`mt-1 block text-right text-[12px] ${profile.story.length > STORY_MAX ? "text-rose-600" : "text-slate-400"}`}>
            {profile.story.length}/{STORY_MAX}
          </span>
        </label>

        <div className="mt-2">
          <Label hint={`สูงสุด ${USP_MAX} ข้อ เช่น "คิดค้นโดยแพทย์ผิวหนัง"`}>จุดเด่นของแบรนด์</Label>
          <ul className="mt-2 flex flex-col gap-2">
            {profile.usp.map((u, i) => (
              <li key={i} className="flex flex-col gap-2 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-start">
                <div className="grid flex-1 gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                  <input
                    value={u.title}
                    onChange={(e) => setUsp(i, { title: e.target.value })}
                    maxLength={40}
                    placeholder="หัวข้อ"
                    aria-label={`หัวข้อจุดเด่นข้อ ${i + 1}`}
                    className="h-11 rounded-lg border border-slate-200 px-3 text-sm outline-hidden focus-visible:border-brand-teal"
                  />
                  <input
                    value={u.text}
                    onChange={(e) => setUsp(i, { text: e.target.value })}
                    maxLength={120}
                    placeholder="คำอธิบายสั้นๆ (ไม่บังคับ)"
                    aria-label={`คำอธิบายจุดเด่นข้อ ${i + 1}`}
                    className="h-11 rounded-lg border border-slate-200 px-3 text-sm outline-hidden focus-visible:border-brand-teal"
                  />
                </div>
                <div className="flex gap-1">
                  <IconButton label="เลื่อนขึ้น" onClick={() => set("usp", move(profile.usp, i, i - 1))} disabled={i === 0}>
                    <ArrowUp size={15} />
                  </IconButton>
                  <IconButton
                    label="เลื่อนลง"
                    onClick={() => set("usp", move(profile.usp, i, i + 1))}
                    disabled={i === profile.usp.length - 1}
                  >
                    <ArrowDown size={15} />
                  </IconButton>
                  <IconButton label="ลบ" onClick={() => set("usp", profile.usp.filter((_, j) => j !== i))}>
                    <Trash2 size={15} />
                  </IconButton>
                </div>
              </li>
            ))}
          </ul>
          {profile.usp.length < USP_MAX && (
            <button
              onClick={() => set("usp", [...profile.usp, { title: "", text: "" }])}
              className="mt-2 flex h-11 items-center gap-1.5 rounded-full border border-dashed border-slate-300 px-4 text-sm font-semibold text-brand-800"
            >
              <Plus size={15} /> เพิ่มจุดเด่น
            </button>
          )}
        </div>
      </Card>

      {/* Featured products */}
      <Card>
        <h2 className="text-base font-bold text-brand-ink">สินค้าแนะนำ</h2>
        <p className="mt-1 text-[12px] text-slate-500">
          ขึ้นเป็นชั้นแรกของหน้าแบรนด์ ตามลำดับที่เลือก (สูงสุด {FEATURED_MAX}) · ไม่เลือก = ใช้สินค้าที่มีรีวิวเยอะที่สุดอัตโนมัติ ·
          สินค้าที่หมดจะถูกข้ามเอง
        </p>

        {profile.featured_slugs.length > 0 && (
          <ol className="mt-3 flex flex-col gap-2">
            {profile.featured_slugs.map((s, i) => {
              const p = productBySlug.get(s);
              return (
                <li key={s} className="flex items-center gap-3 rounded-xl border border-slate-200 p-2 pr-3">
                  <span className="w-5 shrink-0 text-center text-[12px] font-bold text-slate-400">{i + 1}</span>
                  <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-surface-soft">
                    {p?.image && <Image src={p.image} alt="" fill sizes="44px" className="object-contain" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-brand-ink">{p?.name ?? s}</span>
                    {p && !p.inStock && <span className="text-[11px] font-semibold text-amber-700">หมดอยู่ — จะไม่แสดง</span>}
                  </span>
                  <IconButton label="เลื่อนขึ้น" onClick={() => set("featured_slugs", move(profile.featured_slugs, i, i - 1))} disabled={i === 0}>
                    <ArrowUp size={15} />
                  </IconButton>
                  <IconButton
                    label="เลื่อนลง"
                    onClick={() => set("featured_slugs", move(profile.featured_slugs, i, i + 1))}
                    disabled={i === profile.featured_slugs.length - 1}
                  >
                    <ArrowDown size={15} />
                  </IconButton>
                  <IconButton label="เอาออก" onClick={() => set("featured_slugs", profile.featured_slugs.filter((x) => x !== s))}>
                    <Trash2 size={15} />
                  </IconButton>
                </li>
              );
            })}
          </ol>
        )}

        {profile.featured_slugs.length < FEATURED_MAX && (
          <div className="mt-4">
            <input
              value={productQuery}
              onChange={(e) => setProductQuery(e.target.value)}
              placeholder={`ค้นหาสินค้า ${brand.name}`}
              aria-label="ค้นหาสินค้าเพื่อเพิ่มเป็นสินค้าแนะนำ"
              className={inputClass}
            />
            <ul className="mt-2 max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
              {pickable.length === 0 ? (
                <li className="px-3 py-4 text-center text-[13px] text-slate-500">ไม่พบสินค้า</li>
              ) : (
                pickable.map((p) => (
                  <li key={p.slug}>
                    <button
                      onClick={() => set("featured_slugs", [...profile.featured_slugs, p.slug])}
                      className="flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-surface-soft"
                    >
                      <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-md bg-surface-soft">
                        {p.image && <Image src={p.image} alt="" fill sizes="36px" className="object-contain" />}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm text-brand-ink">{p.name}</span>
                      {!p.inStock && <span className="shrink-0 text-[11px] text-amber-700">หมด</span>}
                      <Plus size={15} className="shrink-0 text-brand-800" />
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </Card>

      {/* Layout */}
      <Card>
        <h2 className="flex items-center gap-2 text-base font-bold text-brand-ink">
          <LayoutTemplate size={17} /> การจัดหน้า
        </h2>
        <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
          {customLive
            ? "หน้านี้ใช้การจัดหน้าที่ทีมทำเอง"
            : "หน้านี้ใช้หน้าอัตโนมัติ: หัวแบรนด์ → ปุ่มลัดประเภท → สินค้าแนะนำ → เรื่องราว → สินค้าแยกประเภท → รายชื่อสินค้าทั้งหมด"}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href={`/admin/pages/brand/${slug}`}
            className="flex h-11 items-center gap-2 rounded-full border border-slate-200 px-4 text-sm font-semibold text-brand-800"
          >
            <LayoutTemplate size={15} /> {page ? "แก้การจัดหน้า" : "จัดหน้าแบรนด์นี้เอง"}
          </Link>
          {customLive && (
            <button
              onClick={useAuto}
              className="flex h-11 items-center gap-2 rounded-full border border-slate-200 px-4 text-sm font-semibold text-slate-700"
            >
              <RotateCcw size={15} /> กลับไปใช้หน้าอัตโนมัติ
            </button>
          )}
        </div>
      </Card>

      {/* Save bar: sticky, so the button is reachable from anywhere on a long
          form without covering the admin sidebar, and its width never
          changes with its label. */}
      <div className="sticky bottom-3 z-20 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-card backdrop-blur">
        <div className="flex flex-wrap items-center justify-end gap-3">
          <span className="min-w-0 flex-1 text-[13px]">
            {problems.length > 0 ? (
              <span className="text-rose-600">{problems[0]}</span>
            ) : message ? (
              <span className={message.tone === "ok" ? "text-brand-800" : "text-rose-600"}>{message.text}</span>
            ) : dirty ? (
              <span className="text-slate-500">มีการแก้ไขที่ยังไม่บันทึก</span>
            ) : (
              <span className="text-slate-400">ยังไม่มีการแก้ไข</span>
            )}
          </span>
          <button
            onClick={save}
            disabled={saving || !dirty || problems.length > 0}
            className="flex h-11 w-44 items-center justify-center gap-2 rounded-full bg-brand-gradient text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving && <Loader2 size={15} className="animate-spin" />} บันทึกและเผยแพร่
          </button>
        </div>
      </div>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-surface-soft hover:text-brand-800 disabled:opacity-30"
    >
      {children}
    </button>
  );
}
