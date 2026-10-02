"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import NextImage from "next/image";
import { Alert, Button, Chip, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { ChevronLeft, ChevronRight, ImagePlus, Loader2, Star, X } from "lucide-react";
import { resizeProductImage } from "@/lib/image-utils";
import {
  MAX_IMAGES,
  resolveProductImages,
  type UploadedImage,
} from "@/lib/product-images";
import type { Product } from "@/data/types";

// The one place an admin puts our own photographs on a product.
//
// Two separate things live here and the card keeps them visibly separate,
// because confusing them is the only way to take a product's pictures down by
// accident:
//
//   uploading  — always safe, changes nothing on the shop
//   the switch — the publish button; it is what the shop reads
//
// Everything saves by itself the moment it changes. There is no draft and no
// save button: a half-finished upload with nothing switched on is already the
// safe state, so there is nothing for a draft to protect.
//
// The status chip does not read the switch. It runs the shop's own resolver
// over the live values and reports what that returns, so "switch on, nothing
// uploaded" reads "showing Shopify's" — which is the truth — instead of the
// admin's intention.
//
// resolveProductImages comes from a module that also talks to Supabase. Only
// the pure function is referenced here, so the rest is tree-shaken out, the
// same way this editor already imports isBlockComplete from product-content.ts
// — and the service key is a plain (non-NEXT_PUBLIC) env var, which Next never
// inlines into client code regardless.

type Props = {
  variantId: string;
  product: Pick<Product, "image" | "image2" | "images" | "slug" | "name">;
};

const ACCEPT = ["image/jpeg", "image/png", "image/webp"];

export default function ProductImagesCard({ variantId, product }: Props) {
  const [useCustom, setUseCustom] = useState(false);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [overZone, setOverZone] = useState(false);
  const [dropTarget, setDropTarget] = useState<number | null>(null);

  const fileInput = useRef<HTMLInputElement | null>(null);
  const dragFrom = useRef<number | null>(null);
  const endpoint = `/api/admin/product-content/${encodeURIComponent(variantId)}/images`;

  // What has actually been decided, as opposed to what the last render drew.
  // Deleting two thumbnails quickly is one click per render, and the second
  // click's handler was built from the list before the first one removed
  // anything — so without this, the second delete puts the first one back.
  const latest = useRef({ useCustom, images });
  // And the writes themselves queue, so the row can never be left describing
  // the earlier of two overlapping saves.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const pending = useRef(0);

  useEffect(() => {
    let alive = true;
    fetch(endpoint)
      .then((r) => r.json())
      .then((d) => {
        if (!alive || !d?.ok) return;
        const loaded = {
          useCustom: d.useCustom === true,
          images: Array.isArray(d.images) ? d.images : [],
        };
        latest.current = loaded;
        setUseCustom(loaded.useCustom);
        setImages(loaded.images);
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [endpoint]);

  // "บันทึกแล้ว" is worth saying and not worth leaving on screen.
  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 2500);
    return () => clearTimeout(t);
  }, [saved]);

  /**
   * Write the whole state, and put it back if the server would not take it.
   *
   * Showing the new order and then failing silently would leave the card
   * describing a shop that does not look like that.
   */
  type State = { useCustom: boolean; images: UploadedImage[] };

  const apply = useCallback(
    (change: (cur: State) => State) => {
      const prev = latest.current;
      const next = change(prev);
      // A change that decided to change nothing (moving the first image left)
      // is not worth a round trip or a "saved" flash.
      if (next === prev) return queue.current;
      latest.current = next;
      setUseCustom(next.useCustom);
      setImages(next.images);
      pending.current += 1;
      setSaving(true);
      setError(null);

      const run = async () => {
        try {
          const res = await fetch(endpoint, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...next, slug: product.slug }),
          });
          const data = await res.json().catch(() => null);
          if (!data?.ok) throw new Error(data?.error || "บันทึกรูปไม่สำเร็จ");
          setSaved(true);
        } catch (err) {
          latest.current = prev;
          setUseCustom(prev.useCustom);
          setImages(prev.images);
          setError(err instanceof Error ? err.message : "บันทึกรูปไม่สำเร็จ กรุณาลองใหม่");
        } finally {
          pending.current -= 1;
          if (pending.current === 0) setSaving(false);
        }
      };

      queue.current = queue.current.then(run, run);
      return queue.current;
    },
    [endpoint, product.slug],
  );

  /**
   * One file at a time, on purpose: the count on screen stays true, and five
   * phone photos resizing in parallel is how a laptop fan comes on.
   */
  async function addFiles(picked: File[]) {
    if (progress) return;
    setError(null);

    const room = MAX_IMAGES - latest.current.images.length;
    if (room <= 0) {
      setError(`ใส่รูปได้สูงสุด ${MAX_IMAGES} รูป — ลบรูปเดิมออกก่อน`);
      return;
    }

    const wrongType = picked.filter((f) => !ACCEPT.includes(f.type));
    const files = picked.filter((f) => ACCEPT.includes(f.type));
    const overflow = Math.max(0, files.length - room);
    const queue = files.slice(0, room);

    const skipped: string[] = [];
    if (wrongType.length > 0) {
      skipped.push(
        `ข้าม ${wrongType.length} ไฟล์ที่ไม่ใช่รูป JPG/PNG/WebP (${wrongType
          .map((f) => f.name)
          .slice(0, 3)
          .join(", ")})`,
      );
    }
    if (overflow > 0) skipped.push(`ข้าม ${overflow} รูป เพราะเกิน ${MAX_IMAGES} รูป`);
    if (queue.length === 0) {
      setError(skipped.join(" · ") || "ไม่พบรูปในไฟล์ที่เลือก");
      return;
    }

    setProgress({ done: 0, total: queue.length });
    const added: UploadedImage[] = [];
    const failed: string[] = [];
    for (const file of queue) {
      try {
        const small = await resizeProductImage(file);
        const form = new FormData();
        form.append("image", small);
        const res = await fetch(endpoint, { method: "POST", body: form });
        const data = await res.json().catch(() => null);
        if (data?.ok && data.url) added.push({ url: data.url, path: data.path });
        else failed.push(file.name);
      } catch {
        failed.push(file.name);
      }
      setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
    }
    setProgress(null);

    const notes = [...skipped];
    if (failed.length > 0) notes.push(`อัปโหลดไม่สำเร็จ ${failed.length} รูป (${failed.join(", ")})`);
    if (added.length > 0) {
      await apply((cur) => {
        // Duplicate URLs would collide as React keys in the shop's gallery,
        // and the route drops them anyway.
        const existing = new Set(cur.images.map((i) => i.url));
        return {
          ...cur,
          images: [...cur.images, ...added.filter((i) => !existing.has(i.url))].slice(
            0,
            MAX_IMAGES,
          ),
        };
      });
    }
    if (notes.length > 0) setError(notes.join(" · "));
  }

  function move(from: number, to: number) {
    void apply((cur) => {
      if (from === to || from < 0 || to < 0 || from >= cur.images.length || to >= cur.images.length)
        return cur;
      const next = [...cur.images];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return { ...cur, images: next };
    });
  }

  function remove(i: number) {
    void apply((cur) => ({ ...cur, images: cur.images.filter((_, idx) => idx !== i) }));
  }

  const shopify = resolveProductImages(product, null).images;
  const live = resolveProductImages(product, { variantId, slug: product.slug, useCustom, images });
  const switchedOnButEmpty = useCustom && images.length === 0;

  return (
    <section className="rounded-xl2 bg-white p-4 ring-1 ring-surface-line sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-brand-ink">รูปภาพสินค้า</h2>
        {!loading && (
          <Chip size="sm" color={live.source === "custom" ? "success" : "default"}>
            ตอนนี้เว็บแสดง:{" "}
            {live.source === "custom"
              ? `รูปของเรา (${live.images.length} รูป)`
              : `รูปจาก Shopify (${shopify.length} รูป)`}
          </Chip>
        )}
      </div>

      {loading ? (
        <p className="mt-3 text-sm text-slate-400">กำลังโหลด…</p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <ToggleButtonGroup
              size="sm"
              selectionMode="single"
              disallowEmptySelection
              isDisabled={saving || progress !== null}
              selectedKeys={[useCustom ? "custom" : "shopify"]}
              onSelectionChange={(keys) => {
                const next = [...keys][0] === "custom";
                if (next !== latest.current.useCustom) void apply((cur) => ({ ...cur, useCustom: next }));
              }}
            >
              <ToggleButton id="shopify">ใช้รูปจาก Shopify</ToggleButton>
              <ToggleButton id="custom">ใช้รูปของเรา</ToggleButton>
            </ToggleButtonGroup>
            <span
              aria-live="polite"
              className="text-xs text-slate-500"
            >
              {saving ? "กำลังบันทึก…" : saved ? "บันทึกแล้ว" : ""}
            </span>
          </div>

          {switchedOnButEmpty && (
            <Alert status="warning" className="mt-3">
              <Alert.Content>
                <Alert.Title>ยังไม่มีรูปของเรา</Alert.Title>
                <Alert.Description>
                  เว็บจะแสดงรูปจาก Shopify ไปก่อน จนกว่าจะอัปโหลดรูปอย่างน้อย 1 รูป
                </Alert.Description>
              </Alert.Content>
            </Alert>
          )}

          {error && (
            <Alert status="danger" className="mt-3">
              <Alert.Content>
                <Alert.Description>{error}</Alert.Description>
              </Alert.Content>
            </Alert>
          )}

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="text-xs font-semibold text-slate-600">
                รูปจาก Shopify ({shopify.length} รูป) — ดูอย่างเดียว
              </h3>
              {shopify.length === 0 ? (
                <p className="mt-2 text-xs text-slate-400">สินค้านี้ไม่มีรูปใน Shopify</p>
              ) : (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {shopify.map((url, i) => (
                    <li
                      key={url}
                      className="relative size-20 overflow-hidden rounded-xl bg-surface-soft ring-1 ring-surface-line"
                    >
                      <NextImage src={url} alt="" fill sizes="80px" className="object-cover" />
                      {i === 0 && <Badge>หลัก</Badge>}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className="text-xs font-semibold text-slate-600">
                รูปของเรา ({images.length}/{MAX_IMAGES} รูป)
              </h3>

              <input
                ref={fileInput}
                type="file"
                accept={ACCEPT.join(",")}
                multiple
                className="hidden"
                onChange={(e) => {
                  const picked = Array.from(e.target.files ?? []);
                  e.target.value = "";
                  if (picked.length > 0) void addFiles(picked);
                }}
              />

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setOverZone(true);
                }}
                onDragLeave={() => setOverZone(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setOverZone(false);
                  // A thumbnail dragged here carries no files; ignore it
                  // rather than clearing the list.
                  const dropped = Array.from(e.dataTransfer.files ?? []);
                  if (dropped.length > 0) void addFiles(dropped);
                }}
                className={
                  "mt-2 rounded-xl border-2 border-dashed p-4 text-center transition-colors " +
                  (overZone
                    ? "border-brand-action bg-brand-50"
                    : "border-surface-line bg-surface-soft")
                }
              >
                {progress ? (
                  <p className="inline-flex items-center gap-2 text-sm text-slate-600">
                    <Loader2 size={15} className="animate-spin" />
                    กำลังอัปโหลด {progress.done + 1}/{progress.total} รูป…
                  </p>
                ) : (
                  <>
                    <p className="text-sm text-slate-600">ลากรูปมาวางที่นี่</p>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="mt-2"
                      isDisabled={images.length >= MAX_IMAGES}
                      onPress={() => fileInput.current?.click()}
                    >
                      <ImagePlus size={15} /> เลือกไฟล์
                    </Button>
                    <p className="mt-2 text-xs text-slate-500">
                      JPG, PNG, WebP · เลือกหลายไฟล์ได้ · ย่อขนาดให้อัตโนมัติ
                    </p>
                  </>
                )}
              </div>

              {images.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-3">
                  {images.map((img, i) => (
                    <li
                      key={img.url}
                      draggable
                      onDragStart={(e) => {
                        dragFrom.current = i;
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (dragFrom.current !== null) setDropTarget(i);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (dragFrom.current !== null) move(dragFrom.current, i);
                        dragFrom.current = null;
                        setDropTarget(null);
                      }}
                      onDragEnd={() => {
                        dragFrom.current = null;
                        setDropTarget(null);
                      }}
                      className={
                        "w-20 " + (dropTarget === i ? "opacity-60 ring-2 ring-brand-action rounded-xl" : "")
                      }
                    >
                      <a
                        href={img.url}
                        target="_blank"
                        rel="noreferrer"
                        title="เปิดรูปขนาดเต็ม"
                        className="relative block size-20 cursor-grab overflow-hidden rounded-xl bg-surface-soft ring-1 ring-surface-line"
                      >
                        <NextImage src={img.url} alt="" fill sizes="80px" className="object-cover" />
                        {i === 0 && <Badge>หลัก</Badge>}
                        {i === 1 && <Badge>hover</Badge>}
                      </a>
                      <div className="mt-1 flex items-center justify-center gap-0.5">
                        <ThumbButton
                          label="เลื่อนไปซ้าย"
                          disabled={i === 0}
                          onClick={() => move(i, i - 1)}
                        >
                          <ChevronLeft size={13} />
                        </ThumbButton>
                        <ThumbButton
                          label="ตั้งเป็นรูปหลัก"
                          disabled={i === 0}
                          onClick={() => move(i, 0)}
                        >
                          <Star size={13} />
                        </ThumbButton>
                        <ThumbButton
                          label="เลื่อนไปขวา"
                          disabled={i === images.length - 1}
                          onClick={() => move(i, i + 1)}
                        >
                          <ChevronRight size={13} />
                        </ThumbButton>
                        <ThumbButton label="ลบรูปนี้" onClick={() => remove(i)}>
                          <X size={13} />
                        </ThumbButton>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {images.length > 0 && (
                <p className="mt-2 text-xs text-slate-500">
                  รูปแรกคือรูปหลัก รูปที่สองคือรูปที่โชว์ตอนชี้เมาส์ — ลากสลับลำดับได้
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function Badge({ children }: { children: string }) {
  return (
    <span className="absolute inset-x-0 bottom-0 bg-brand-ink/75 py-0.5 text-center text-[10px] font-semibold text-white">
      {children}
    </span>
  );
}

function ThumbButton({
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
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="rounded-md p-1 text-slate-500 transition-colors hover:bg-surface-soft hover:text-brand-800 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-action disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}
