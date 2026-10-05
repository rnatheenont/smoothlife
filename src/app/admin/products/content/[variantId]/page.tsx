"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import RichTextArea from "@/components/admin/RichTextArea";
import { renderInline, renderRichText } from "@/lib/rich-text";
import {
  ArrowLeft,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  AlertTriangle,
  ExternalLink,
  Sparkles,
  Upload,
  Eye,
  EyeOff,
} from "lucide-react";
import ProductMediaCard from "@/components/admin/products/ProductMediaCard";
import { products } from "@/data/products";
import { Button, Checkbox, Input } from "@heroui/react";
import {
  BLOCK_TYPES,
  emptyBlock,
  isBlockEmpty,
  FIXED_HEADING,
  isBlockComplete,
  parseVideoUrl,
  type ContentBlock,
} from "@/lib/product-content";

// The editor for one product's free-form content blocks. Left: a rough
// preview in either language. Right: the blocks themselves — add, remove,
// reorder, write both languages side by side. Saving as a draft never
// touches the live page; publishing does, immediately (see the API route's
// revalidateTag call).

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
  // Whether some of what is on screen is starter scaffold rather than saved
  // work. Nothing has been written to the database at this point — opening a
  // product must not be the same as creating content for it.
  const [scaffold, setScaffold] = useState(false);
  // …and whether the scaffold was added next to content that was already
  // there, which is a draft being topped up rather than a blank product.
  const [toppedUp, setToppedUp] = useState(false);
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
      .then((d) => {
        // The server decides what a product starts with — and, for a draft,
        // which sections it is still missing — so the team can change it in
        // /admin/products/content/starter without a deploy.
        const starter = Array.isArray(d?.starter) ? d.starter : [];
        const saved = d?.override?.blocks;
        if (Array.isArray(saved) && saved.length > 0) {
          // Appended, never interleaved: where somebody put their own blocks
          // is their decision, and the skeleton arriving later does not get
          // to reorder it.
          setBlocks(starter.length > 0 ? [...saved, ...starter] : saved);
          setScaffold(starter.length > 0);
          setToppedUp(starter.length > 0);
          return;
        }
        setBlocks(starter);
        setScaffold(starter.length > 0);
      })
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

  // Both counts ignore parked blocks: they are not on the page, so they cannot
  // be wrong on it.
  const shownBlocks = blocks.filter((b) => !b.hidden);
  const incompleteCount = shownBlocks.filter((b) => !isBlockComplete(b)).length;
  // The scaffold is empty by definition; saying so the moment the page opens
  // would make an untouched product look like a product with mistakes in it.
  // A block with nothing in it at all is a placeholder waiting to be filled,
  // so while every unfinished block is in that state the page is still the
  // skeleton; the first half-written block is a real "cannot publish yet".
  // Stated that way rather than by remembering which blocks were added, so it
  // survives deleting and reordering them.
  const untouched =
    scaffold &&
    incompleteCount > 0 &&
    incompleteCount === shownBlocks.filter(isBlockEmpty).length;
  const unverifiedCount = shownBlocks.filter(
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

      {/* Pictures before words: it is the first thing anyone wants to fix, and
          it saves on its own — nothing below's draft/publish buttons touch it. */}
      <div className="mt-5">
        <ProductMediaCard variantId={variantId} product={product} />
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-slate-400">กำลังโหลด…</p>
      ) : (
        <div className="mt-6 grid gap-6 [grid-template-columns:minmax(0,1fr)] lg:[grid-template-columns:minmax(0,1fr)_minmax(0,1.4fr)]">
          {/* The one-column track is spelled out rather than left implicit: an
              implicit `auto` track is sized by its content's min-content
              width, and the spec table in the preview is wider than a phone —
              which scrolled the whole page sideways. */}
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
              {blocks.map((b, i) =>
                b.hidden ? (
                  <div key={i} className="mb-4 opacity-45 last:mb-0">
                    <p className="mb-1 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                      <EyeOff size={11} /> ซ่อนจากลูกค้า
                    </p>
                    <PreviewBlock block={b} lang={previewLang} />
                  </div>
                ) : (
                  <PreviewBlock key={i} block={b} lang={previewLang} />
                ),
              )}
            </div>
          </div>

          {/* editor */}
          <div>
            {note && (
              <p className="mb-3 rounded-lg bg-surface-soft px-3 py-2 text-sm text-slate-600">
                {note}
              </p>
            )}
            {untouched && (
              <p className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-800">
                {toppedUp
                  ? "ร่างนี้ยังขาดบางหัวข้อตามโครง — วางบล็อกเปล่าไว้ให้แล้วต่อท้ายของเดิม ของที่เขียนไว้ไม่ถูกแตะ เติมในช่องได้เลย บล็อกไหนไม่ใช้กดถังขยะลบทิ้งได้ และบล็อกที่เพิ่มให้ยังไม่ถูกบันทึกจนกว่าจะกด “บันทึกร่าง” หรือ “เผยแพร่”"
                  : "สินค้านี้ยังไม่มีเนื้อหา — วางโครงไว้ให้แล้ว เติมในช่องได้เลย บล็อกไหนไม่ใช้กดถังขยะลบทิ้งได้ และยังไม่มีอะไรถูกบันทึกจนกว่าจะกด “บันทึกร่าง” หรือ “เผยแพร่”"}{" "}
                ·{" "}
                <Link
                  href="/admin/products/content/starter"
                  className="font-semibold underline underline-offset-2"
                >
                  แก้โครงเริ่มต้น
                </Link>
              </p>
            )}
            {!untouched && (incompleteCount > 0 || unverifiedCount > 0) && (
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
                onPress={() => save(false)}
                isPending={saving === "draft"}
                isDisabled={Boolean(saving)}
              >
                บันทึกร่าง
              </Button>
              <Button
                onPress={() => save(true)}
                isPending={saving === "publish"}
                isDisabled={Boolean(saving)}
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

/**
 * The lines of a bullet list or an ingredients row, with the same bold/italic
 * toolbar the body fields have.
 *
 * It keeps the text it is given rather than the parsed items: the parent
 * stores string[] and parsing throws away blank lines, so round-tripping every
 * keystroke through it meant pressing Enter did nothing — the empty line was
 * dropped and the caret jumped back up. The draft is what the person typed;
 * the parent still gets the items.
 */
function ItemsEditor({
  items,
  onChange,
  placeholder,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState(items.join("\n"));
  useEffect(() => {
    // Only when the change came from somewhere else — "ช่วยร่าง", a block
    // moving — never to rewrite what is being typed right now.
    const joined = items.join("\n");
    setDraft((d) => (linesToItems(d).join("\n") === joined ? d : joined));
  }, [items]);
  return (
    <RichTextArea
      value={draft}
      onChange={(v) => {
        setDraft(v);
        onChange(linesToItems(v));
      }}
      placeholder={placeholder}
      rows={5}
      showList={false}
    />
  );
}

/** Nothing for the assistant to write: a picture and a clip are links somebody
 *  has to choose, and a caption for a file it cannot see would be invention. */
const DRAFTABLE = (t: ContentBlock["type"]) => t !== "image" && t !== "video";

/**
 * A picture: paste a link, or choose a file and let the upload produce one.
 * The field stays editable either way — the upload is the convenience, not the
 * only route, and the same URL rules apply to both (see IMAGE_HOSTS in the PUT
 * route, which is what actually decides).
 */
function ImageField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (url: string) => void;
  placeholder: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("image", file);
      const res = await fetch("/api/admin/product-content/upload-image", {
        method: "POST",
        body: form,
      });
      const data = await res.json().catch(() => null);
      if (!data?.ok) {
        setError(data?.error || "อัปโหลดไม่สำเร็จ");
        return;
      }
      onChange(data.url);
    } catch {
      setError("อัปโหลดไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <Input
          aria-label={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
        <label
          className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-600 hover:border-brand-teal hover:text-brand-800 ${
            busy ? "pointer-events-none opacity-50" : ""
          }`}
        >
          <Upload size={13} />
          {busy ? "กำลังอัปโหลด…" : "อัปโหลด"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              // Cleared so choosing the same file again still fires onChange.
              e.target.value = "";
              if (file) upload(file);
            }}
          />
        </label>
      </div>
      {error && <p className="text-xs text-rose-500">{error}</p>}
    </div>
  );
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

  const hidden = block.hidden === true;

  return (
    <div
      className={`rounded-xl2 bg-white p-4 ring-1 ring-surface-line ${
        hidden ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          {typeLabel}
          {hidden && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-slate-500">
              ซ่อนจากลูกค้า
            </span>
          )}
        </span>
        <div className="flex items-center gap-1">
          <Checkbox
            isSelected={block.hasVerifiedSource ?? false}
            onChange={(v) =>
              onChange({ hasVerifiedSource: v } as Partial<ContentBlock>)
            }
            className="mr-2 text-xs text-slate-500"
          >
            <Checkbox.Content className="flex items-center gap-1.5">
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              มีแหล่งอ้างอิงแล้ว
            </Checkbox.Content>
          </Checkbox>
          {DRAFTABLE(block.type) && (
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
          )}
          <button
            type="button"
            onClick={() =>
              onChange({ hidden: !hidden } as Partial<ContentBlock>)
            }
            title={
              hidden
                ? "แสดงบล็อกนี้ในหน้าสินค้า"
                : "ซ่อนบล็อกนี้ไม่ให้ลูกค้าเห็น (ยังเก็บไว้ที่นี่)"
            }
            aria-pressed={hidden}
            className={`grid size-9 shrink-0 place-items-center rounded-full ${
              hidden
                ? "bg-slate-100 text-slate-600"
                : "text-slate-400 hover:bg-surface-soft"
            }`}
          >
            {hidden ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
          {onMoveUp && (
            <button
              type="button"
              onClick={onMoveUp}
              aria-label="ย้ายบล็อกนี้ขึ้น"
              title="ย้ายขึ้น"
              className="grid size-9 shrink-0 place-items-center rounded-full text-slate-400 hover:bg-surface-soft"
            >
              <ChevronUp size={14} aria-hidden="true" />
            </button>
          )}
          {onMoveDown && (
            <button
              type="button"
              onClick={onMoveDown}
              aria-label="ย้ายบล็อกนี้ลง"
              title="ย้ายลง"
              className="grid size-9 shrink-0 place-items-center rounded-full text-slate-400 hover:bg-surface-soft"
            >
              <ChevronDown size={14} aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            onClick={onRemove}
            aria-label="ลบบล็อกนี้"
            title="ลบบล็อกนี้"
            className="grid size-9 shrink-0 place-items-center rounded-full text-rose-400 hover:bg-rose-50"
          >
            <Trash2 size={14} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="mt-3 space-y-3">
        {(block.type === "paragraph" || block.type === "image_text") && (
          <>
            {block.type === "image_text" && (
              <Input
                aria-label="ลิงก์รูปภาพ (https://...)"
                value={block.imageUrl}
                onChange={(e) =>
                  onChange({
                    imageUrl: e.target.value,
                  } as Partial<ContentBlock>)
                }
                placeholder="ลิงก์รูปภาพ (https://...)"
              />
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                aria-label="หัวข้อ (ไทย) — ไม่บังคับ"
                value={block.headingTh ?? ""}
                onChange={(e) =>
                  onChange({
                    headingTh: e.target.value,
                  } as Partial<ContentBlock>)
                }
                placeholder="หัวข้อ (ไทย) — ไม่บังคับ"
              />
              <Input
                aria-label="Heading (English) — optional"
                value={block.headingEn ?? ""}
                onChange={(e) =>
                  onChange({
                    headingEn: e.target.value,
                  } as Partial<ContentBlock>)
                }
                placeholder="Heading (English) — optional"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <RichTextArea
                value={block.bodyTh}
                onChange={(v) =>
                  onChange({ bodyTh: v } as Partial<ContentBlock>)
                }
                placeholder="เนื้อหา (ไทย)"
              />
              <RichTextArea
                value={block.bodyEn}
                onChange={(v) =>
                  onChange({ bodyEn: v } as Partial<ContentBlock>)
                }
                placeholder="Content (English)"
              />
            </div>
          </>
        )}

        {(block.type === "bullet_list" ||
          block.type === "ingredients" ||
          block.type === "who_for" ||
          block.type === "how_to_use") && (
          <>
            {block.type === "bullet_list" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  aria-label="หัวข้อ (ไทย) — ไม่บังคับ"
                  value={block.headingTh ?? ""}
                  onChange={(e) =>
                    onChange({
                      headingTh: e.target.value,
                    } as Partial<ContentBlock>)
                  }
                  placeholder="หัวข้อ (ไทย) — ไม่บังคับ"
                />
                <Input
                  aria-label="Heading (English) — optional"
                  value={block.headingEn ?? ""}
                  onChange={(e) =>
                    onChange({
                      headingEn: e.target.value,
                    } as Partial<ContentBlock>)
                  }
                  placeholder="Heading (English) — optional"
                />
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <ItemsEditor
                items={block.itemsTh}
                onChange={(itemsTh) =>
                  onChange({ itemsTh } as Partial<ContentBlock>)
                }
                placeholder={
                  block.type === "how_to_use"
                    ? "ขั้นตอน (ไทย) — บรรทัดละ 1 ขั้น"
                    : "รายการ (ไทย) — บรรทัดละ 1 รายการ"
                }
              />
              <ItemsEditor
                items={block.itemsEn}
                onChange={(itemsEn) =>
                  onChange({ itemsEn } as Partial<ContentBlock>)
                }
                placeholder={
                  block.type === "how_to_use"
                    ? "Steps (English) — one per line"
                    : "Items (English) — one per line"
                }
              />
            </div>
          </>
        )}

        {block.type === "image" && (
          <>
            <ImageField
              value={block.imageUrl}
              onChange={(url) =>
                onChange({ imageUrl: url } as Partial<ContentBlock>)
              }
              placeholder="ลิงก์รูปภาพ (https://...) หรือกดอัปโหลด"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                aria-label="คำบรรยายใต้รูป (ไทย) — ไม่บังคับ"
                value={block.captionTh ?? ""}
                onChange={(e) =>
                  onChange({
                    captionTh: e.target.value,
                  } as Partial<ContentBlock>)
                }
                placeholder="คำบรรยายใต้รูป (ไทย) — ไม่บังคับ"
              />
              <Input
                aria-label="Caption (English) — optional"
                value={block.captionEn ?? ""}
                onChange={(e) =>
                  onChange({
                    captionEn: e.target.value,
                  } as Partial<ContentBlock>)
                }
                placeholder="Caption (English) — optional"
              />
            </div>
          </>
        )}

        {block.type === "video" && (
          <>
            <Input
              aria-label="ลิงก์วิดีโอ — YouTube, Facebook, TikTok, Instagram, Vimeo หรือไฟล์ .mp4"
              value={block.videoUrl}
              onChange={(e) =>
                onChange({ videoUrl: e.target.value } as Partial<ContentBlock>)
              }
              placeholder="ลิงก์วิดีโอ — YouTube, Facebook, TikTok, Instagram, Vimeo หรือไฟล์ .mp4"
            />
            {/* Said here rather than at save time: the admin is looking at the
                field they just pasted into, and the message names the one
                thing to change. */}
            {block.videoUrl.trim() && !parseVideoUrl(block.videoUrl) && (
              <p className="flex items-start gap-1.5 text-xs text-rose-500">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                ลิงก์นี้ยังเล่นไม่ได้ — ใช้ลิงก์วิดีโอจาก YouTube, Facebook,
                TikTok, Instagram, Vimeo หรือไฟล์ .mp4 จาก Shopify /
                smoothlife.com (ลิงก์ย่อ vt.tiktok.com ใช้ไม่ได้
                ให้เปิดคลิปแล้วก๊อปลิงก์เต็ม)
              </p>
            )}
            <ImageField
              value={block.posterUrl ?? ""}
              onChange={(url) =>
                onChange({ posterUrl: url } as Partial<ContentBlock>)
              }
              placeholder="รูปปกก่อนกดเล่น — ไม่บังคับ (ใช้กับไฟล์วิดีโอ)"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                aria-label="คำบรรยายใต้วิดีโอ (ไทย) — ไม่บังคับ"
                value={block.captionTh ?? ""}
                onChange={(e) =>
                  onChange({
                    captionTh: e.target.value,
                  } as Partial<ContentBlock>)
                }
                placeholder="คำบรรยายใต้วิดีโอ (ไทย) — ไม่บังคับ"
              />
              <Input
                aria-label="Caption (English) — optional"
                value={block.captionEn ?? ""}
                onChange={(e) =>
                  onChange({
                    captionEn: e.target.value,
                  } as Partial<ContentBlock>)
                }
                placeholder="Caption (English) — optional"
              />
            </div>
          </>
        )}

        {block.type === "spec_table" && (
          <div className="space-y-2">
            {block.rows.map((row, ri) => (
              <div
                key={ri}
                // Four fields in a row need a phone-width fallback: `1fr` is
                // minmax(auto,1fr), and a HeroUI Input's auto width is the
                // browser's 20-character default — four of those are wider
                // than any phone, which scrolled the page sideways. Two
                // columns here, four from sm up, and minmax(0,…) so a track
                // may go narrower than its field wants to be.
                className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-1.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
              >
                <Input
                  fullWidth
                  aria-label="หัวข้อ (ไทย)"
                  value={row.labelTh}
                  onChange={(e) => {
                    const rows = [...block.rows];
                    rows[ri] = { ...rows[ri], labelTh: e.target.value };
                    onChange({ rows } as Partial<ContentBlock>);
                  }}
                  placeholder="หัวข้อ (ไทย)"
                />
                <Input
                  fullWidth
                  aria-label="Label (EN)"
                  value={row.labelEn}
                  onChange={(e) => {
                    const rows = [...block.rows];
                    rows[ri] = { ...rows[ri], labelEn: e.target.value };
                    onChange({ rows } as Partial<ContentBlock>);
                  }}
                  placeholder="Label (EN)"
                />
                <Input
                  fullWidth
                  aria-label="ค่า (ไทย)"
                  value={row.valueTh}
                  onChange={(e) => {
                    const rows = [...block.rows];
                    rows[ri] = { ...rows[ri], valueTh: e.target.value };
                    onChange({ rows } as Partial<ContentBlock>);
                  }}
                  placeholder="ค่า (ไทย)"
                />
                <Input
                  fullWidth
                  aria-label="Value (EN)"
                  value={row.valueEn}
                  onChange={(e) => {
                    const rows = [...block.rows];
                    rows[ri] = { ...rows[ri], valueEn: e.target.value };
                    onChange({ rows } as Partial<ContentBlock>);
                  }}
                  placeholder="Value (EN)"
                />
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      rows: block.rows.filter((_, idx) => idx !== ri),
                    } as Partial<ContentBlock>)
                  }
                  aria-label="ลบแถวนี้"
                  title="ลบแถวนี้"
                  className="col-span-2 grid size-9 place-items-center justify-self-end rounded-lg text-rose-400 hover:bg-rose-50 sm:col-span-1"
                >
                  <Trash2 size={14} aria-hidden="true" />
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
          <div className="text-sm text-slate-600">
            {renderRichText(pick(block.bodyTh, block.bodyEn)) ?? "—"}
          </div>
        </div>
      );
    case "image_text":
      return (
        <div className="mb-4 last:mb-0">
          {block.imageUrl && (
            /* The whole picture, at its own shape. It used to be cropped into
               a 128px-tall strip, which showed the admin a slice of their own
               image and none of what the product page would show. */
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={block.imageUrl}
              alt=""
              className="mb-2 w-full rounded-lg bg-surface-soft"
            />
          )}
          {(block.headingTh || block.headingEn) && (
            <p className="mb-1 text-sm font-bold text-brand-ink">
              {pick(block.headingTh ?? "", block.headingEn ?? "")}
            </p>
          )}
          <div className="text-sm text-slate-600">
            {renderRichText(pick(block.bodyTh, block.bodyEn)) ?? "—"}
          </div>
        </div>
      );
    case "image":
      return (
        <div className="mb-4 last:mb-0">
          {block.imageUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={block.imageUrl}
              alt=""
              className="w-full rounded-lg bg-surface-soft"
            />
          ) : (
            <p className="text-sm text-slate-400">— ยังไม่ได้ใส่รูป</p>
          )}
          {pick(block.captionTh ?? "", block.captionEn ?? "") && (
            <p className="mt-1 text-xs text-slate-500">
              {pick(block.captionTh ?? "", block.captionEn ?? "")}
            </p>
          )}
        </div>
      );
    case "video": {
      const video = parseVideoUrl(block.videoUrl);
      return (
        <div className="mb-4 last:mb-0">
          {video ? (
            <div
              className={`relative w-full overflow-hidden rounded-lg bg-black ${
                video.aspect === "16 / 9" ? "" : "mx-auto max-w-[240px]"
              }`}
              style={{ aspectRatio: video.aspect }}
            >
              {video.kind === "file" ? (
                <video
                  src={video.src}
                  poster={block.posterUrl || undefined}
                  controls
                  preload="metadata"
                  className="h-full w-full"
                />
              ) : (
                <iframe
                  src={video.src}
                  title="ตัวอย่างวิดีโอ"
                  loading="lazy"
                  allowFullScreen
                  className="absolute inset-0 h-full w-full border-0"
                />
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-400">— ยังไม่ได้ใส่ลิงก์วิดีโอ</p>
          )}
          {pick(block.captionTh ?? "", block.captionEn ?? "") && (
            <p className="mt-1 text-xs text-slate-500">
              {pick(block.captionTh ?? "", block.captionEn ?? "")}
            </p>
          )}
        </div>
      );
    }
    case "bullet_list":
    case "ingredients":
    case "who_for":
    case "how_to_use": {
      const items = lang === "th" ? block.itemsTh : block.itemsEn;
      const fallback = lang === "th" ? block.itemsEn : block.itemsTh;
      const shown = items.length ? items : fallback;
      return (
        <div className="mb-4 last:mb-0">
          {"headingTh" in block && (block.headingTh || block.headingEn) ? (
            <p className="mb-1 text-sm font-bold text-brand-ink">
              {pick(block.headingTh ?? "", block.headingEn ?? "")}
            </p>
          ) : (
            FIXED_HEADING[block.type] && (
              <p className="mb-1 text-sm font-bold text-brand-ink">
                {pick(
                  FIXED_HEADING[block.type]?.th ?? "",
                  FIXED_HEADING[block.type]?.en ?? "",
                )}
              </p>
            )
          )}
          {shown.length === 0 ? (
            <p className="text-sm text-slate-400">—</p>
          ) : (
            <ul
              className={`space-y-0.5 text-sm text-slate-600 ${
                block.type === "how_to_use"
                  ? "list-inside list-decimal"
                  : "list-inside list-disc"
              }`}
            >
              {shown.map((item, i) => (
                <li key={i}>{renderInline(item)}</li>
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
