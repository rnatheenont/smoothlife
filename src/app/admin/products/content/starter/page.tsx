"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { Button } from "@heroui/react";
import { PageHeader, Panel } from "@/components/admin/layout-kit";
import AdminField from "@/components/admin/AdminField";
import AdminSelect from "@/components/admin/AdminSelect";
import {
  BLOCK_TYPES,
  FIXED_HEADING,
  emptyBlock,
  type ContentBlock,
} from "@/lib/product-content";

// What a product with no write-up opens with.
//
// Structure only — which sections, in what order, called what. There is no
// body to fill in here on purpose: a starter carrying words would put the same
// sentence on every product nobody had got to yet, and the save route rebuilds
// whatever is sent from empty blocks so it cannot happen by accident.
//
// Its own small editor rather than the product one: that editor is built for
// writing, and most of it — rich text, bullet lists, images, the AI draft
// button, the published/draft split — has nothing to act on in a skeleton.

/** The blocks that carry a heading somebody chooses, as opposed to a fixed one
 *  (ส่วนผสม, วิธีใช้) or none at all (a picture, a clip, the spec table). */
function hasOwnHeading(type: ContentBlock["type"]): boolean {
  return (
    type === "paragraph" || type === "bullet_list" || type === "image_text"
  );
}

function headingOf(block: ContentBlock, lang: "Th" | "En"): string {
  const fixed = FIXED_HEADING[block.type];
  if (fixed) return lang === "Th" ? fixed.th : fixed.en;
  const key = lang === "Th" ? "headingTh" : "headingEn";
  return ((block as Record<string, unknown>)[key] as string) ?? "";
}

export default function StarterBlocksPage() {
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [builtIn, setBuiltIn] = useState<ContentBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/product-content/starter")
      .then((r) => r.json())
      .then((d) => {
        if (!d?.ok) return;
        setBlocks(Array.isArray(d.blocks) ? d.blocks : []);
        setBuiltIn(Array.isArray(d.builtIn) ? d.builtIn : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(null), 3000);
    return () => clearTimeout(t);
  }, [note]);

  function update(i: number, patch: Partial<ContentBlock>) {
    setBlocks((b) =>
      b.map((blk, idx) =>
        idx === i ? ({ ...blk, ...patch } as ContentBlock) : blk,
      ),
    );
  }
  function move(i: number, dir: -1 | 1) {
    setBlocks((b) => {
      const j = i + dir;
      if (j < 0 || j >= b.length) return b;
      const next = [...b];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setNote(null);
    try {
      const res = await fetch("/api/admin/product-content/starter", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks }),
      });
      const data = await res.json().catch(() => null);
      if (!data?.ok) {
        setNote(data?.error || "บันทึกไม่สำเร็จ");
        return;
      }
      // Saved as the server rebuilt it, so what is on screen is what the next
      // product will actually open with.
      setBlocks(data.blocks);
      setNote("บันทึกแล้ว — สินค้าที่ยังไม่มีเนื้อหาจะเปิดมาเจอโครงนี้");
    } catch {
      setNote("บันทึกไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <Link
        href="/admin/products/content"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand-800"
      >
        <ArrowLeft size={15} aria-hidden="true" /> กลับไปรายการสินค้า
      </Link>

      <PageHeader
        title="โครงเริ่มต้นของเนื้อหาสินค้า"
        subtitle="สินค้าที่ยังไม่เคยเขียนเนื้อหาจะเปิดมาเจอบล็อกชุดนี้วางไว้ให้ — ตั้งไว้ว่าหน้าสินค้าของเราควรมีหัวข้ออะไรบ้าง"
      />

      {loading ? (
        <p className="mt-4 text-sm text-slate-400">กำลังโหลด…</p>
      ) : (
        <>
          <Panel title={`บล็อกในโครง (${blocks.length})`} padded>
            {blocks.length === 0 ? (
              <p className="text-[13px] text-slate-500">
                ยังไม่มีบล็อกในโครง — สินค้าใหม่จะเปิดมาเจอหน้าเปล่า
                ซึ่งก็เป็นทางเลือกหนึ่ง
              </p>
            ) : (
              <ul className="space-y-3">
                {blocks.map((block, i) => {
                  const fixed = FIXED_HEADING[block.type];
                  return (
                    <li
                      key={i}
                      className="rounded-xl2 bg-surface-soft p-3 ring-1 ring-surface-line"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="w-5 shrink-0 text-right text-[12px] tabular-nums text-slate-400">
                          {i + 1}.
                        </span>
                        <AdminSelect
                          label={`ชนิดของบล็อกที่ ${i + 1}`}
                          className="min-w-[160px]"
                          value={block.type}
                          onChange={(v) =>
                            setBlocks((b) =>
                              b.map((blk, idx) =>
                                idx === i
                                  ? emptyBlock(v as ContentBlock["type"])
                                  : blk,
                              ),
                            )
                          }
                          options={BLOCK_TYPES.map((t) => ({
                            value: t.key,
                            label: t.label,
                          }))}
                        />
                        <span className="ms-auto flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => move(i, -1)}
                            disabled={i === 0}
                            aria-label="ย้ายขึ้น"
                            title="ย้ายขึ้น"
                            className="grid size-9 shrink-0 place-items-center rounded-full text-slate-400 hover:bg-white disabled:opacity-30"
                          >
                            <ChevronUp size={14} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => move(i, 1)}
                            disabled={i === blocks.length - 1}
                            aria-label="ย้ายลง"
                            title="ย้ายลง"
                            className="grid size-9 shrink-0 place-items-center rounded-full text-slate-400 hover:bg-white disabled:opacity-30"
                          >
                            <ChevronDown size={14} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setBlocks((b) => b.filter((_, idx) => idx !== i))
                            }
                            aria-label="เอาบล็อกนี้ออกจากโครง"
                            title="เอาออกจากโครง"
                            className="grid size-9 shrink-0 place-items-center rounded-full text-rose-400 hover:bg-rose-50"
                          >
                            <Trash2 size={14} aria-hidden="true" />
                          </button>
                        </span>
                      </div>

                      {hasOwnHeading(block.type) ? (
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          <AdminField
                            label="หัวข้อ (ไทย)"
                            value={headingOf(block, "Th")}
                            onChange={(v) =>
                              update(i, {
                                headingTh: v,
                              } as Partial<ContentBlock>)
                            }
                            placeholder="เช่น คุณสมบัติ"
                          />
                          <AdminField
                            label="หัวข้อ (อังกฤษ)"
                            value={headingOf(block, "En")}
                            onChange={(v) =>
                              update(i, {
                                headingEn: v,
                              } as Partial<ContentBlock>)
                            }
                            placeholder="e.g. Properties"
                          />
                        </div>
                      ) : (
                        <p className="mt-2 ps-7 text-[12px] text-slate-500">
                          {fixed
                            ? `หัวข้อคงที่: ${fixed.th} / ${fixed.en}`
                            : "บล็อกชนิดนี้ไม่มีหัวข้อ"}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="mt-3 flex flex-wrap gap-1.5">
              {BLOCK_TYPES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setBlocks((b) => [...b, emptyBlock(t.key)])}
                  className="inline-flex items-center gap-1 rounded-full border border-surface-line px-3 py-1.5 text-[12px] font-semibold text-slate-600 hover:bg-surface-soft hover:text-brand-ink"
                >
                  <Plus size={12} aria-hidden="true" /> {t.label}
                </button>
              ))}
            </div>
          </Panel>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button variant="primary" isPending={saving} onPress={save}>
              บันทึกโครง
            </Button>
            <Button
              variant="outline"
              isDisabled={saving || builtIn.length === 0}
              onPress={() => setBlocks(builtIn)}
            >
              <RotateCcw size={14} aria-hidden="true" /> กลับไปใช้ค่าเริ่มต้น
            </Button>
            {note && <span className="text-[13px] text-slate-600">{note}</span>}
          </div>

          <p className="mt-3 max-w-prose text-[12px] text-slate-500">
            โครงนี้มีผลกับสินค้าที่<strong>ยังไม่เคยเขียนเนื้อหา</strong>
            เท่านั้น สินค้าที่เขียนไปแล้วไม่เปลี่ยนตาม และโครงเก็บแค่โครงสร้าง —
            ชนิดบล็อกกับหัวข้อ ไม่มีเนื้อหาข้างใน
          </p>
        </>
      )}
    </div>
  );
}
