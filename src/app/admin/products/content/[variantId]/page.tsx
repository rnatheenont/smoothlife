"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  AlertTriangle,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui";
import { products } from "@/data/products";
import {
  BLOCK_TYPES,
  isBlockComplete,
  type ContentBlock,
} from "@/lib/product-content";

// The editor for one product's free-form content blocks. Left: a rough
// preview in either language. Right: the blocks themselves — add, remove,
// reorder, write both languages side by side. Saving as a draft never
// touches the live page; publishing does, immediately (see the API route's
// revalidateTag call).

function emptyBlock(type: ContentBlock["type"]): ContentBlock {
  switch (type) {
    case "paragraph":
      return { type, bodyTh: "", bodyEn: "" };
    case "image_text":
      return { type, imageUrl: "", bodyTh: "", bodyEn: "" };
    case "bullet_list":
      return { type, itemsTh: [], itemsEn: [] };
    case "ingredients":
      return { type, itemsTh: [], itemsEn: [] };
    case "spec_table":
      return { type, rows: [] };
  }
}

function linesToItems(v: string): string[] {
  return v
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function ProductContentEditPage() {
  const params = useParams<{ variantId: string }>();
  const variantId = decodeURIComponent(params.variantId);
  const router = useRouter();

  // Not `p.variantId === variantId` — this page is opened with the *stable*
  // variant (stableContentVariantId), which on a multi-variant product is
  // often not the one `Product.variantId` currently points at (that field is
  // the cheapest-in-stock variant, recomputed on every build). The product
  // this content belongs to is whichever one actually has this variant.
  const product = useMemo(
    () =>
      products.find((p) => p.variants.some((v) => v.variantId === variantId)),
    [variantId],
  );
  const sku =
    product?.variants.find((v) => v.variantId === variantId)?.sku ?? null;

  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<"draft" | "publish" | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [previewLang, setPreviewLang] = useState<"th" | "en">("th");
  const [drafting, setDrafting] = useState<number | null>(null);

  /**
   * Ask the assistant to fill one block in from the product's own catalogue
   * entry. It fills the fields and nothing else: hasVerifiedSource is forced
   * back to false whatever came back, because a draft is by definition
   * something nobody has pointed at a document for yet, and the checkbox is
   * the one thing in this editor a machine must never tick for a person.
   */
  async function draftBlock(i: number) {
    const block = blocks[i];
    if (!block || drafting !== null) return;
    setDrafting(i);
    setNote(null);
    try {
      const res = await fetch(
        `/api/admin/product-content/${encodeURIComponent(variantId)}/suggest`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: block.type }),
        },
      );
      const data = await res.json().catch(() => null);
      if (!data?.ok) {
        setNote(data?.error || "ร่างไม่สำเร็จ กรุณาลองใหม่");
        return;
      }
      updateBlock(i, {
        ...data.draft,
        hasVerifiedSource: false,
      } as Partial<ContentBlock>);
      setNote(
        "ร่างด้วย AI แล้ว — ตรวจเนื้อหาและติ๊ก “มีแหล่งอ้างอิงแล้ว” ก่อนเผยแพร่",
      );
    } catch {
      setNote("ร่างไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setDrafting(null);
    }
  }

  useEffect(() => {
    fetch(`/api/admin/product-content/${encodeURIComponent(variantId)}`)
      .then((r) => r.json())
      .then((d) => setBlocks(d?.override?.blocks ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [variantId]);

  function addBlock(type: ContentBlock["type"]) {
    setBlocks((b) => [...b, emptyBlock(type)]);
  }
  function removeBlock(i: number) {
    setBlocks((b) => b.filter((_, idx) => idx !== i));
  }
  function moveBlock(i: number, dir: -1 | 1) {
    setBlocks((b) => {
      const j = i + dir;
      if (j < 0 || j >= b.length) return b;
      const next = [...b];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }
  function updateBlock(i: number, patch: Partial<ContentBlock>) {
    setBlocks((b) =>
      b.map((block, idx) =>
        idx === i ? ({ ...block, ...patch } as ContentBlock) : block,
      ),
    );
  }

  async function save(publish: boolean) {
    setSaving(publish ? "publish" : "draft");
    setNote(null);
    try {
      const res = await fetch(
        `/api/admin/product-content/${encodeURIComponent(variantId)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            blocks,
            published: publish,
            sku,
            slug: product?.slug ?? null,
          }),
        },
      );
      const data = await res.json();
      if (!data.ok) {
        setNote(data.error || "บันทึกไม่สำเร็จ");
        return;
      }
      setNote(publish ? "เผยแพร่แล้ว" : "บันทึกร่างแล้ว");
      router.refresh();
    } catch {
      setNote("บันทึกไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setSaving(null);
    }
  }

  if (!product) {
    return (
      <p className="text-sm text-slate-500">
        ไม่พบสินค้านี้ในแคตตาล็อก (variant id ไม่ตรงกับที่มีอยู่)
      </p>
    );
  }

  const incompleteCount = blocks.filter((b) => !isBlockComplete(b)).length;
  const unverifiedCount = blocks.filter(
    (b) => b.hasVerifiedSource === false,
  ).length;

  return (
    <div>
      <Link
        href="/admin/products/content"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand-800"
      >
        <ArrowLeft size={15} /> กลับไปรายการสินค้า
      </Link>

      <div className="mt-3 flex items-center gap-3">
        <span className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-surface-soft ring-1 ring-surface-line">
          {product.image && (
            <Image
              src={product.image}
              alt=""
              fill
              sizes="48px"
              className="object-cover"
            />
          )}
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold text-brand-ink">
            {product.name}
          </h1>
          <p className="text-xs text-slate-500">
            SKU: {sku ?? "ไม่มี"} ·{" "}
            <Link
              href={`/product/${product.slug}`}
              target="_blank"
              className="inline-flex items-center gap-1 hover:text-brand-800"
            >
              ดูหน้าจริง <ExternalLink size={11} />
            </Link>
          </p>
        </div>
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-slate-400">กำลังโหลด…</p>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          {/* preview */}
          <div className="lg:sticky lg:top-20 lg:self-start">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-brand-ink">ตัวอย่าง</h2>
              <div className="inline-flex rounded-full bg-surface-muted p-1 text-xs">
                {(["th", "en"] as const).map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setPreviewLang(l)}
                    className={
                      previewLang === l
                        ? "rounded-full bg-white px-3 py-1 font-semibold text-brand-ink shadow-card"
                        : "rounded-full px-3 py-1 font-medium text-slate-500"
                    }
                  >
                    {l === "th" ? "ไทย" : "English"}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-2 rounded-xl2 bg-white p-4 ring-1 ring-surface-line">
              {blocks.length === 0 && (
                <p className="text-sm text-slate-400">
                  ยังไม่มีเนื้อหา — เพิ่มบล็อกทางขวาได้เลย
                </p>
              )}
              {blocks.map((b, i) => (
                <PreviewBlock key={i} block={b} lang={previewLang} />
              ))}
            </div>
          </div>

          {/* editor */}
          <div>
            {note && (
              <p className="mb-3 rounded-lg bg-surface-soft px-3 py-2 text-sm text-slate-600">
                {note}
              </p>
            )}
            {(incompleteCount > 0 || unverifiedCount > 0) && (
              <p className="mb-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <span>
                  {incompleteCount > 0 && (
                    <>
                      มี {incompleteCount} บล็อกที่ยังเขียนไม่ครบทั้งไทย-อังกฤษ
                      — เผยแพร่ไม่ได้จนกว่าจะเติมครบ{" "}
                    </>
                  )}
                  {unverifiedCount > 0 && (
                    <>
                      มี {unverifiedCount} บล็อกที่ยังไม่มีแหล่งอ้างอิง —
                      ตรวจสอบก่อนเผยแพร่
                    </>
                  )}
                </span>
              </p>
            )}

            <div className="space-y-4">
              {blocks.map((b, i) => (
                <BlockEditor
                  key={i}
                  block={b}
                  onChange={(patch) => updateBlock(i, patch)}
                  onRemove={() => removeBlock(i)}
                  onMoveUp={i > 0 ? () => moveBlock(i, -1) : undefined}
                  onMoveDown={
                    i < blocks.length - 1 ? () => moveBlock(i, 1) : undefined
                  }
                  onDraft={() => draftBlock(i)}
                  drafting={drafting === i}
                />
              ))}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {BLOCK_TYPES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => addBlock(t.key)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-brand-teal hover:text-brand-800"
                >
                  <Plus size={13} /> {t.label}
                </button>
              ))}
            </div>

            <div className="mt-6 flex items-center gap-3 border-t border-surface-line pt-4">
              <Button
                variant="secondary"
                onClick={() => save(false)}
                loading={saving === "draft"}
                disabled={Boolean(saving)}
              >
                บันทึกร่าง
              </Button>
              <Button
                onClick={() => save(true)}
                loading={saving === "publish"}
                disabled={Boolean(saving)}
              >
                เผยแพร่
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function fieldClass() {
  return "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-hidden focus:border-brand-teal";
}

function BlockEditor({
  block,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  onDraft,
  drafting,
}: {
  block: ContentBlock;
  onChange: (patch: Partial<ContentBlock>) => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onDraft: () => void;
  drafting: boolean;
}) {
  const typeLabel =
    BLOCK_TYPES.find((t) => t.key === block.type)?.label ?? block.type;

  return (
    <div className="rounded-xl2 bg-white p-4 ring-1 ring-surface-line">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          {typeLabel}
        </span>
        <div className="flex items-center gap-1">
          <label className="mr-2 flex items-center gap-1.5 text-xs text-slate-500">
            <input
              type="checkbox"
              checked={block.hasVerifiedSource ?? false}
              onChange={(e) =>
                onChange({
                  hasVerifiedSource: e.target.checked,
                } as Partial<ContentBlock>)
              }
              className="size-3.5 rounded"
            />
            มีแหล่งอ้างอิงแล้ว
          </label>
          <button
            type="button"
            onClick={onDraft}
            disabled={drafting}
            title="ร่างเนื้อหาบล็อกนี้จากข้อมูลสินค้าที่มีอยู่"
            className="mr-1 inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-brand-800 transition-colors hover:bg-surface-soft disabled:opacity-50"
          >
            <Sparkles size={13} />
            {drafting ? "กำลังร่าง…" : "ช่วยร่าง"}
          </button>
          {onMoveUp && (
            <button
              type="button"
              onClick={onMoveUp}
              className="grid size-7 place-items-center rounded-full text-slate-400 hover:bg-surface-soft"
            >
              <ChevronUp size={14} />
            </button>
          )}
          {onMoveDown && (
            <button
              type="button"
              onClick={onMoveDown}
              className="grid size-7 place-items-center rounded-full text-slate-400 hover:bg-surface-soft"
            >
              <ChevronDown size={14} />
            </button>
          )}
          <button
            type="button"
            onClick={onRemove}
            className="grid size-7 place-items-center rounded-full text-rose-400 hover:bg-rose-50"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="mt-3 space-y-3">
        {(block.type === "paragraph" || block.type === "image_text") && (
          <>
            {block.type === "image_text" && (
              <input
                value={block.imageUrl}
                onChange={(e) =>
                  onChange({
                    imageUrl: e.target.value,
                  } as Partial<ContentBlock>)
                }
                placeholder="ลิงก์รูปภาพ (https://...)"
                className={fieldClass()}
              />
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                value={block.headingTh ?? ""}
                onChange={(e) =>
                  onChange({
                    headingTh: e.target.value,
                  } as Partial<ContentBlock>)
                }
                placeholder="หัวข้อ (ไทย) — ไม่บังคับ"
                className={fieldClass()}
              />
              <input
                value={block.headingEn ?? ""}
                onChange={(e) =>
                  onChange({
                    headingEn: e.target.value,
                  } as Partial<ContentBlock>)
                }
                placeholder="Heading (English) — optional"
                className={fieldClass()}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <textarea
                value={block.bodyTh}
                onChange={(e) =>
                  onChange({ bodyTh: e.target.value } as Partial<ContentBlock>)
                }
                rows={4}
                placeholder="เนื้อหา (ไทย)"
                className={fieldClass()}
              />
              <textarea
                value={block.bodyEn}
                onChange={(e) =>
                  onChange({ bodyEn: e.target.value } as Partial<ContentBlock>)
                }
                rows={4}
                placeholder="Content (English)"
                className={fieldClass()}
              />
            </div>
          </>
        )}

        {(block.type === "bullet_list" || block.type === "ingredients") && (
          <>
            {block.type === "bullet_list" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  value={block.headingTh ?? ""}
                  onChange={(e) =>
                    onChange({
                      headingTh: e.target.value,
                    } as Partial<ContentBlock>)
                  }
                  placeholder="หัวข้อ (ไทย) — ไม่บังคับ"
                  className={fieldClass()}
                />
                <input
                  value={block.headingEn ?? ""}
                  onChange={(e) =>
                    onChange({
                      headingEn: e.target.value,
                    } as Partial<ContentBlock>)
                  }
                  placeholder="Heading (English) — optional"
                  className={fieldClass()}
                />
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <textarea
                value={block.itemsTh.join("\n")}
                onChange={(e) =>
                  onChange({
                    itemsTh: linesToItems(e.target.value),
                  } as Partial<ContentBlock>)
                }
                rows={5}
                placeholder={"รายการ (ไทย) — บรรทัดละ 1 รายการ"}
                className={fieldClass()}
              />
              <textarea
                value={block.itemsEn.join("\n")}
                onChange={(e) =>
                  onChange({
                    itemsEn: linesToItems(e.target.value),
                  } as Partial<ContentBlock>)
                }
                rows={5}
                placeholder={"Items (English) — one per line"}
                className={fieldClass()}
              />
            </div>
          </>
        )}

        {block.type === "spec_table" && (
          <div className="space-y-2">
            {block.rows.map((row, ri) => (
              <div
                key={ri}
                className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-1.5"
              >
                <input
                  value={row.labelTh}
                  onChange={(e) => {
                    const rows = [...block.rows];
                    rows[ri] = { ...rows[ri], labelTh: e.target.value };
                    onChange({ rows } as Partial<ContentBlock>);
                  }}
                  placeholder="หัวข้อ (ไทย)"
                  className={fieldClass()}
                />
                <input
                  value={row.labelEn}
                  onChange={(e) => {
                    const rows = [...block.rows];
                    rows[ri] = { ...rows[ri], labelEn: e.target.value };
                    onChange({ rows } as Partial<ContentBlock>);
                  }}
                  placeholder="Label (EN)"
                  className={fieldClass()}
                />
                <input
                  value={row.valueTh}
                  onChange={(e) => {
                    const rows = [...block.rows];
                    rows[ri] = { ...rows[ri], valueTh: e.target.value };
                    onChange({ rows } as Partial<ContentBlock>);
                  }}
                  placeholder="ค่า (ไทย)"
                  className={fieldClass()}
                />
                <input
                  value={row.valueEn}
                  onChange={(e) => {
                    const rows = [...block.rows];
                    rows[ri] = { ...rows[ri], valueEn: e.target.value };
                    onChange({ rows } as Partial<ContentBlock>);
                  }}
                  placeholder="Value (EN)"
                  className={fieldClass()}
                />
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      rows: block.rows.filter((_, idx) => idx !== ri),
                    } as Partial<ContentBlock>)
                  }
                  className="grid size-9 place-items-center rounded-lg text-rose-400 hover:bg-rose-50"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                onChange({
                  rows: [
                    ...block.rows,
                    { labelTh: "", labelEn: "", valueTh: "", valueEn: "" },
                  ],
                } as Partial<ContentBlock>)
              }
              className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-800 hover:underline"
            >
              <Plus size={13} /> เพิ่มแถว
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function PreviewBlock({
  block,
  lang,
}: {
  block: ContentBlock;
  lang: "th" | "en";
}) {
  const pick = (th: string, en: string) =>
    (lang === "th" ? th : en) || (lang === "th" ? en : th);

  switch (block.type) {
    case "paragraph":
      return (
        <div className="mb-4 last:mb-0">
          {(block.headingTh || block.headingEn) && (
            <p className="mb-1 text-sm font-bold text-brand-ink">
              {pick(block.headingTh ?? "", block.headingEn ?? "")}
            </p>
          )}
          <p className="whitespace-pre-line text-sm text-slate-600">
            {pick(block.bodyTh, block.bodyEn) || "—"}
          </p>
        </div>
      );
    case "image_text":
      return (
        <div className="mb-4 last:mb-0">
          {block.imageUrl && (
            <div className="relative mb-2 h-32 w-full overflow-hidden rounded-lg bg-surface-soft">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={block.imageUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            </div>
          )}
          {(block.headingTh || block.headingEn) && (
            <p className="mb-1 text-sm font-bold text-brand-ink">
              {pick(block.headingTh ?? "", block.headingEn ?? "")}
            </p>
          )}
          <p className="whitespace-pre-line text-sm text-slate-600">
            {pick(block.bodyTh, block.bodyEn) || "—"}
          </p>
        </div>
      );
    case "bullet_list":
    case "ingredients": {
      const items = lang === "th" ? block.itemsTh : block.itemsEn;
      const fallback = lang === "th" ? block.itemsEn : block.itemsTh;
      const shown = items.length ? items : fallback;
      return (
        <div className="mb-4 last:mb-0">
          {"headingTh" in block && (block.headingTh || block.headingEn) && (
            <p className="mb-1 text-sm font-bold text-brand-ink">
              {pick(block.headingTh ?? "", block.headingEn ?? "")}
            </p>
          )}
          {shown.length === 0 ? (
            <p className="text-sm text-slate-400">—</p>
          ) : (
            <ul className="list-inside list-disc space-y-0.5 text-sm text-slate-600">
              {shown.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          )}
        </div>
      );
    }
    case "spec_table":
      return (
        <div className="mb-4 last:mb-0">
          {block.rows.length === 0 ? (
            <p className="text-sm text-slate-400">—</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {block.rows.map((row, i) => (
                  <tr
                    key={i}
                    className="border-b border-surface-line/60 last:border-0"
                  >
                    <td className="py-1.5 pr-3 font-medium text-brand-ink">
                      {pick(row.labelTh, row.labelEn)}
                    </td>
                    <td className="py-1.5 text-slate-600">
                      {pick(row.valueTh, row.valueEn)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      );
  }
}
