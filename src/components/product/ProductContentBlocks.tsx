"use client";

import Image from "next/image";
import { useLang } from "@/lib/lang-context";
import type { ContentBlock } from "@/lib/product-content";

// The product copy the shop writes itself, rendered from its blocks.
//
// Marked translate="no" around the whole thing, which is the point rather than
// a detail: everywhere else on this page the English is produced by running
// the Thai through the translator on each visit. These words were written and
// reviewed in both languages precisely so that the claims made about a health
// or beauty product are not machine output, and handing them back to the
// translator would undo that.

function hasText(block: ContentBlock, th: boolean): boolean {
  switch (block.type) {
    case "paragraph":
    case "image_text":
      return Boolean((th ? block.bodyTh : block.bodyEn)?.trim());
    case "bullet_list":
    case "ingredients":
      return (th ? block.itemsTh : block.itemsEn).some((i) => i.trim());
    case "spec_table":
      return block.rows.some((r) => (th ? r.valueTh : r.valueEn).trim());
  }
}

export default function ProductContentBlocks({
  blocks,
}: {
  blocks: ContentBlock[];
}) {
  const { lang } = useLang();
  const th = lang === "th";
  // A block written in one language only is skipped in the other rather than
  // shown with an empty body or, worse, its Thai under an English heading.
  const shown = blocks.filter((b) => hasText(b, th));
  if (shown.length === 0) return null;

  const heading = (thText?: string, enText?: string) => {
    const text = (th ? thText : enText)?.trim();
    return text ? (
      <h3 className="mb-2 font-bold text-brand-ink">{text}</h3>
    ) : null;
  };
  const items = (block: { itemsTh: string[]; itemsEn: string[] }) =>
    (th ? block.itemsTh : block.itemsEn).map((i) => i.trim()).filter(Boolean);

  return (
    <div translate="no" className="space-y-7">
      {shown.map((block, i) => {
        switch (block.type) {
          case "paragraph":
            return (
              <section key={i}>
                {heading(block.headingTh, block.headingEn)}
                <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">
                  {th ? block.bodyTh : block.bodyEn}
                </p>
              </section>
            );
          case "bullet_list":
            return (
              <section key={i}>
                {heading(block.headingTh, block.headingEn)}
                <ul className="space-y-1.5">
                  {items(block).map((item, n) => (
                    <li
                      key={n}
                      className="flex gap-2 text-sm leading-relaxed text-slate-600"
                    >
                      <span
                        aria-hidden
                        className="mt-2 size-1.5 shrink-0 rounded-full bg-brand-teal"
                      />
                      {item}
                    </li>
                  ))}
                </ul>
              </section>
            );
          case "ingredients":
            return (
              <section key={i}>
                <h3 className="mb-2 font-bold text-brand-ink">
                  {th ? "ส่วนผสม" : "Ingredients"}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {items(block).map((item, n) => (
                    <span
                      key={n}
                      className="rounded-full bg-surface-soft px-3 py-1.5 text-[13px] text-slate-600"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </section>
            );
          case "image_text":
            return (
              <section
                key={i}
                className="grid gap-4 sm:grid-cols-[200px_1fr] sm:items-start"
              >
                {block.imageUrl && (
                  <span className="relative block aspect-square w-full overflow-hidden rounded-xl2 bg-surface-soft">
                    <Image
                      src={block.imageUrl}
                      alt=""
                      fill
                      sizes="(max-width: 640px) 100vw, 200px"
                      className="object-cover"
                    />
                  </span>
                )}
                <div>
                  {heading(block.headingTh, block.headingEn)}
                  <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">
                    {th ? block.bodyTh : block.bodyEn}
                  </p>
                </div>
              </section>
            );
          case "spec_table":
            return (
              <section key={i}>
                <dl className="divide-y divide-slate-100 overflow-hidden rounded-xl2 ring-1 ring-slate-100">
                  {block.rows
                    .filter((r) => (th ? r.valueTh : r.valueEn).trim())
                    .map((row, n) => (
                      <div
                        key={n}
                        className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] gap-3 px-4 py-2.5"
                      >
                        <dt className="text-[13px] text-slate-500">
                          {th ? row.labelTh : row.labelEn}
                        </dt>
                        <dd className="text-[13px] text-brand-ink">
                          {th ? row.valueTh : row.valueEn}
                        </dd>
                      </div>
                    ))}
                </dl>
              </section>
            );
        }
      })}
    </div>
  );
}
