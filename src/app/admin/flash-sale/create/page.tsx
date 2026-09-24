"use client";

import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Check, ImagePlus, Loader2, Search, X, Zap } from "lucide-react";
import { Button, Field } from "@/components/ui";
import { PageHeader } from "@/components/admin/layout-kit";
import { products } from "@/data/products";
import { formatTHB } from "@/lib/format";

// The real campaign creator — distinct from /admin/flash-sale, which is a
// clickable walkthrough of the queue mechanic and never writes a row. This
// one posts to POST /api/admin/flash-sale/campaigns and puts a real
// campaign live.

// datetime-local has no timezone of its own — it reads back whatever the
// browser's local zone is, which for this shop is always Bangkok, so this
// never needs to ask.
function toLocalInputValue(ms: number): string {
  const d = new Date(ms - new Date().getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
}
function fromLocalInputValue(v: string): number | null {
  if (!v) return null;
  const ms = new Date(v).getTime();
  return Number.isFinite(ms) ? ms : null;
}

type PricingMode = "regular" | "percent" | "fixed";

export default function CreateFlashSaleCampaignPage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [query, setQuery] = useState("");
  const [productSlug, setProductSlug] = useState<string | null>(null);

  const [stock, setStock] = useState(25);
  const [windowMinutes, setWindowMinutes] = useState(15);
  const [maxRequeue, setMaxRequeue] = useState(10);

  const [pricingMode, setPricingMode] = useState<PricingMode>("regular");
  const [percent, setPercent] = useState(20);
  const [fixedPrice, setFixedPrice] = useState<string>("");

  const [startsAt, setStartsAt] = useState(() => toLocalInputValue(Date.now() + 60 * 60 * 1000));
  const [endsAt, setEndsAt] = useState("");

  const [useBanner, setUseBanner] = useState(false);
  const [heroImage, setHeroImage] = useState<string | null>(null);
  const [heroHeadline, setHeroHeadline] = useState("");
  const [heroNote, setHeroNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = productSlug ? products.find((p) => p.slug === productSlug) : null;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.slug.includes(q)).slice(0, 20);
  }, [query]);

  async function handleBannerPick(file: File) {
    setUploadError(null);
    setUploading(true);
    try {
      const body = new FormData();
      body.append("image", file);
      const res = await fetch("/api/admin/flash-sale/upload-image", { method: "POST", body });
      const data = await res.json();
      if (!data.ok) {
        setUploadError(data.error || "อัปโหลดไม่สำเร็จ");
        return;
      }
      setHeroImage(data.url);
    } catch {
      setUploadError("อัปโหลดไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    setError(null);
    if (!title.trim()) return setError("กรุณาตั้งชื่อแคมเปญ");
    if (!productSlug) return setError("กรุณาเลือกสินค้า");
    const startsMs = fromLocalInputValue(startsAt);
    if (startsMs === null) return setError("กรุณาเลือกวันเวลาเริ่มขาย");
    const endsMs = endsAt ? fromLocalInputValue(endsAt) : null;

    const pricing =
      pricingMode === "regular"
        ? { mode: "regular" as const }
        : pricingMode === "percent"
          ? { mode: "percent" as const, percent }
          : { mode: "fixed" as const, prices: { [productSlug]: Number(fixedPrice) } };

    setSaving(true);
    try {
      const res = await fetch("/api/admin/flash-sale/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          mode: "single",
          kind: useBanner ? "special" : "regular",
          productSlugs: [productSlug],
          stockPerProduct: stock,
          windowMinutes,
          maxRequeue,
          pricing,
          startsAt: startsMs,
          endsAt: endsMs,
          ...(useBanner
            ? { heroImage, heroHeadline: heroHeadline.trim() || null, heroNote: heroNote.trim() || null }
            : {}),
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "บันทึกไม่สำเร็จ");
        return;
      }
      // refresh before push: the list is a server component, and the client
      // router serves it from its own cache on a push. Without this the
      // campaign that was just saved is missing from the list it lands on,
      // and stays missing until someone reloads the page by hand.
      router.refresh();
      router.push("/admin/flash-sale");
    } catch {
      setError("บันทึกไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        icon={<Zap size={20} className="text-brand-emerald" />}
        title="สร้างแคมเปญ Flash Sale"
        subtitle="ตั้งค่าแล้วเปิดขายจริงตามเวลาที่กำหนด — คนละหน้ากับ Flash Sale เดิมที่เป็นแค่ตัวอย่างสาธิต"
      />

      <div className="mt-6 space-y-5 rounded-xl2 bg-white p-5 ring-1 ring-surface-line">
        <Field label="ชื่อแคมเปญ" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="เช่น Flash Sale 25 ชิ้น — Thomas Kong Set" required />

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-brand-ink">สินค้า</label>
          {selected ? (
            <div className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-surface-soft p-2.5">
              <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-white">
                {selected.image && <Image src={selected.image} alt="" fill sizes="40px" className="object-cover" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-brand-ink">{selected.name}</p>
                <p className="text-xs text-slate-500">฿{formatTHB(selected.price).replace("฿", "")}</p>
              </div>
              <button type="button" onClick={() => setProductSlug(null)} className="shrink-0 text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>
          ) : (
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ค้นหาชื่อสินค้า…"
                className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-hidden focus:border-brand-teal"
              />
              {matches.length > 0 && (
                <ul className="mt-1.5 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-card">
                  {matches.map((p) => (
                    <li key={p.slug}>
                      <button
                        type="button"
                        onClick={() => {
                          setProductSlug(p.slug);
                          setQuery("");
                        }}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-surface-soft"
                      >
                        <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded bg-surface-soft">
                          {p.image && <Image src={p.image} alt="" fill sizes="32px" className="object-cover" />}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{p.name}</span>
                        <span className="shrink-0 text-xs text-slate-400">฿{p.price}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Field
            label="สต็อก (ชิ้น)"
            type="number"
            min={1}
            max={10000}
            value={stock}
            onChange={(e) => setStock(Number(e.target.value))}
          />
          <Field
            label="เวลาชำระเงิน (นาที)"
            type="number"
            min={1}
            max={120}
            value={windowMinutes}
            onChange={(e) => setWindowMinutes(Number(e.target.value))}
          />
          <Field
            label="กลับเข้าคิวได้กี่ครั้ง"
            type="number"
            min={0}
            max={10}
            value={maxRequeue}
            onChange={(e) => setMaxRequeue(Number(e.target.value))}
            hint="สูงสุด 10 (ระบบไม่รองรับไม่จำกัด)"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-brand-ink">ราคา</label>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["regular", "ราคาปกติ"],
                ["percent", "ลด %"],
                ["fixed", "ตั้งราคาเอง"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setPricingMode(key)}
                className={
                  "rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 transition-colors " +
                  (pricingMode === key
                    ? "bg-brand-gradient-soft text-brand-800 ring-brand-action/40"
                    : "text-slate-600 ring-surface-line hover:bg-surface-soft")
                }
              >
                {label}
              </button>
            ))}
          </div>
          {pricingMode === "percent" && (
            <Field
              className="mt-2"
              label="ลดกี่เปอร์เซ็นต์"
              type="number"
              min={1}
              max={90}
              value={percent}
              onChange={(e) => setPercent(Number(e.target.value))}
            />
          )}
          {pricingMode === "fixed" && (
            <Field
              className="mt-2"
              label="ราคา Flash Sale (บาท)"
              type="number"
              min={1}
              value={fixedPrice}
              onChange={(e) => setFixedPrice(e.target.value)}
            />
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="เริ่มขาย" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required />
          <Field label="ปิดการขาย (ไม่บังคับ)" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
        </div>

        <div className="border-t border-surface-line pt-4">
          <label className="flex items-center gap-2 text-sm font-semibold text-brand-ink">
            <input type="checkbox" checked={useBanner} onChange={(e) => setUseBanner(e.target.checked)} className="size-4 rounded" />
            ทำเป็นแคมเปญพิเศษ (มีแบนเนอร์ของตัวเอง)
          </label>
          <p className="mt-1 text-xs text-slate-500">
            หน้าขายจะใช้ header/footer ของ smoothlife.com และให้เข้าสู่ระบบด้วยบัญชี smoothlife.com —
            สำหรับลิงก์ที่ส่งออกไปหาลูกค้าที่รู้จักแต่ร้านเดิม · ไม่เลือก = หน้าขายมาตรฐานบนเว็บนี้ ไม่มีแบนเนอร์
          </p>

          {useBanner && (
            <div className="mt-3 space-y-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-brand-ink">รูปแบนเนอร์</label>
                {heroImage ? (
                  <div className="relative h-32 w-full overflow-hidden rounded-lg bg-surface-soft">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={heroImage} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setHeroImage(null)}
                      className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-black/60 text-white"
                      aria-label="ลบรูป"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex h-32 w-full flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-slate-200 text-slate-400 hover:border-brand-teal hover:text-brand-800 disabled:opacity-50"
                  >
                    {uploading ? <Loader2 size={20} className="animate-spin" /> : <ImagePlus size={20} />}
                    <span className="text-xs">{uploading ? "กำลังอัปโหลด…" : "แนบรูปแบนเนอร์ (ไม่เกิน 5MB)"}</span>
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleBannerPick(file);
                    e.target.value = "";
                  }}
                />
                {uploadError && <p className="mt-1 text-xs text-rose-600">{uploadError}</p>}
              </div>
              <Field label="หัวข้อบนแบนเนอร์ (ไม่บังคับ)" value={heroHeadline} onChange={(e) => setHeroHeadline(e.target.value)} maxLength={120} />
              <Field label="ข้อความย่อย (ไม่บังคับ)" multiline value={heroNote} onChange={(e) => setHeroNote(e.target.value)} maxLength={300} />
            </div>
          )}
        </div>

        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

        <Button onClick={submit} loading={saving} disabled={saving} fullWidth>
          <Check size={16} />
          {saving ? "กำลังบันทึก…" : "สร้างแคมเปญ"}
        </Button>
      </div>
    </div>
  );
}
