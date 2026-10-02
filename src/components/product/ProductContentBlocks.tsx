"use client";

import Image from "next/image";
import { useState } from "react";
import { useLang } from "@/lib/lang-context";
import { parseVideoUrl, type ContentBlock } from "@/lib/product-content";
import { renderRichText } from "@/lib/rich-text";

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
    // A picture and a clip say the same thing in both languages — the caption
    // under them is optional, so neither is hidden for want of one.
    case "image":
      return Boolean(block.imageUrl.trim());
    case "video":
      return parseVideoUrl(block.videoUrl) !== null;
  }
}

/**
 * A content picture at its own shape. The frame takes the file's aspect ratio
 * once it loads rather than cropping it to a guess: these are label shots,
 * ingredient diagrams and how-to-use panels, where the cut-off part is usually
 * the part with the words on it.
 */
function ContentImage({
  src,
  alt,
  sizes = "(max-width: 768px) 100vw, 680px",
}: {
  src: string;
  alt: string;
  sizes?: string;
}) {
  const [ratio, setRatio] = useState<number | null>(null);
  return (
    <span
      className={`relative block w-full overflow-hidden rounded-xl2 bg-surface-soft ${
        ratio ? "" : "aspect-[4/3]"
      }`}
      style={ratio ? { aspectRatio: String(ratio) } : undefined}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        className="object-contain"
        onLoad={(e) => {
          const img = e.currentTarget;
          if (img.naturalWidth && img.naturalHeight) {
            setRatio(img.naturalWidth / img.naturalHeight);
          }
        }}
      />
    </span>
  );
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
                <div className="text-sm leading-relaxed text-slate-600">
                  {renderRichText(th ? block.bodyTh : block.bodyEn)}
                </div>
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
                // Half and half, not a 200px thumbnail beside a line of text
                // running the full width of the page: at desktop width that
                // left the picture small, the measure far too long to read
                // comfortably, and the bottom right of the block empty.
                className="grid gap-5 sm:grid-cols-2 sm:items-start"
              >
                {block.imageUrl && (
                  // Its own shape, not a square crop: a label shot or an
                  // ingredient diagram loses the part with the words on it
                  // when it is cropped to fit.
                  <ContentImage
                    src={block.imageUrl}
                    alt=""
                    sizes="(max-width: 640px) 100vw, 50vw"
                  />
                )}
                <div>
                  {heading(block.headingTh, block.headingEn)}
                  <div className="text-sm leading-relaxed text-slate-600">
                    {renderRichText(th ? block.bodyTh : block.bodyEn)}
                  </div>
                </div>
              </section>
            );
          case "image": {
            const caption = (th ? block.captionTh : block.captionEn)?.trim();
            return (
              <figure key={i}>
                <ContentImage src={block.imageUrl} alt={caption || ""} />
                {caption && (
                  <figcaption className="mt-2 text-[13px] text-slate-500">
                    {caption}
                  </figcaption>
                )}
              </figure>
            );
          }
          case "video": {
            const video = parseVideoUrl(block.videoUrl);
            if (!video) return null;
            const caption = (th ? block.captionTh : block.captionEn)?.trim();
            return (
              <figure key={i}>
                <div className="relative aspect-video w-full overflow-hidden rounded-xl2 bg-black">
                  {video.kind === "file" ? (
                    <video
                      src={video.src}
                      poster={block.posterUrl || undefined}
                      controls
                      playsInline
                      // metadata, not auto: a product page should not pull a
                      // video down a phone's data plan before anyone presses
                      // play.
                      preload="metadata"
                      className="h-full w-full"
                    />
                  ) : (
                    <iframe
                      src={video.src}
                      title={caption || (th ? "วิดีโอสินค้า" : "Product video")}
                      // Lazy, so the player is fetched when it is scrolled to
                      // rather than on every page view.
                      loading="lazy"
                      allow="accelerated-2d-canvas; encrypted-media; picture-in-picture; fullscreen"
                      allowFullScreen
                      className="absolute inset-0 h-full w-full border-0"
                    />
                  )}
                </div>
                {caption && (
                  <figcaption className="mt-2 text-[13px] text-slate-500">
                    {caption}
                  </figcaption>
                )}
              </figure>
            );
          }
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
