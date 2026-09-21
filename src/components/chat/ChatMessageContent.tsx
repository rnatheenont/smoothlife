"use client";

import { useState, ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { Check, Plus } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { useLang } from "@/lib/lang-context";
import { getProductBySlug } from "@/data/products";
import { formatTHB } from "@/lib/format";

// How an assistant reply becomes what a customer actually sees — product
// mentions turned into real cards, **bold** into emphasis, a run of "- "
// lines into a proper list, bare URLs into links. Shared by the chat widget
// and the full-screen page (see use-chat-session.ts's file comment) so a
// product card looks and behaves identically wherever the conversation is
// read.

// Matches the [[slug]] markers the model is told to use, but also tolerates
// a stray single-bracket [slug] (models occasionally drop a bracket) and
// bare /product/slug links, so a product card still renders instead of
// leaking raw marker text into the chat bubble.
const MARKER = /\[\[([a-z0-9-]+)\]\]|\[([a-z0-9]+(?:-[a-z0-9]+)+)\]|\/product\/([a-z0-9-]+)/gi;

// Lightweight markdown-bold support (**text**) so an occasional ** from the
// model renders as bold instead of showing the literal asterisks — the chat
// bubble is plain whitespace-pre-wrap text, not a markdown renderer.
const BOLD = /\*\*(.+?)\*\*/g;

// Staff paste links — a Kerry depot on Google Maps, a tracking page — and the
// bubble is plain text, so they arrived as something to copy by hand off a
// phone screen. Trailing punctuation is left out of the link: a URL at the end
// of a Thai sentence usually has a full stop or a bracket after it.
const URL_RE = /https?:\/\/[^\s<]+[^\s<.,:;"')\]}]/g;

function renderLinks(text: string, keyPrefix: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  URL_RE.lastIndex = 0;
  while ((m = URL_RE.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(
      <a
        key={`${keyPrefix}u${k++}`}
        href={m[0]}
        target="_blank"
        rel="noopener noreferrer"
        className="break-all underline underline-offset-2 hover:opacity-80"
      >
        {m[0]}
      </a>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let last = 0;
  let bm: RegExpExecArray | null;
  BOLD.lastIndex = 0;
  let k = 0;
  while ((bm = BOLD.exec(text))) {
    if (bm.index > last) parts.push(...renderLinks(text.slice(last, bm.index), `${keyPrefix}${k}`));
    parts.push(<strong key={`${keyPrefix}b${k++}`}>{bm[1]}</strong>);
    last = bm.index + bm[0].length;
  }
  if (last < text.length) parts.push(...renderLinks(text.slice(last), `${keyPrefix}t`));
  return parts;
}

export function ProductChip({ slug }: { slug: string }) {
  const product = getProductBySlug(slug);
  const { addItem } = useCart();
  const { t } = useLang();
  const [added, setAdded] = useState(false);
  if (!product) return null;

  return (
    <div className="my-2 flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-2 shadow-xs">
      <Link href={`/product/${product.slug}`} className="shrink-0 relative h-14 w-14 block">
        <Image
          src={product.image}
          alt={product.name}
          fill
          className="rounded-lg object-cover bg-surface-soft"
        />
      </Link>
      <div className="min-w-0 flex-1">
        <Link
          href={`/product/${product.slug}`}
          translate="no"
          className="block text-[12px] font-semibold leading-snug text-brand-ink line-clamp-2 hover:text-brand-800"
        >
          {product.name}
        </Link>
        <div className="mt-0.5 flex items-baseline gap-1.5">
          <span className="text-[12px] font-bold text-brand-800">{formatTHB(product.price)}</span>
          {product.compareAtPrice ? (
            <span className="text-[10px] text-slate-500 line-through">{formatTHB(product.compareAtPrice)}</span>
          ) : null}
        </div>
      </div>
      <button
        onClick={() => {
          addItem(product.slug, 1);
          setAdded(true);
        }}
        aria-label={t("เพิ่มลงตะกร้า", "Add to cart")}
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-white transition-colors ${
          added ? "bg-slate-300" : "bg-brand-gradient"
        }`}
      >
        {added ? <Check size={15} /> : <Plus size={15} />}
      </button>
    </div>
  );
}

// Breaks a plain-text segment into paragraph/list blocks so a long reply
// reads as scannable chunks instead of one dense wall of text — consecutive
// "- " lines become a real bulleted list (dot marker, own line), everything
// else stays grouped into paragraphs separated by blank lines.
function renderTextBlock(text: string, keyPrefix: string): ReactNode[] {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let blockKey = 0;
  while (i < lines.length) {
    if (lines[i].trim() === "") {
      i++;
      continue;
    }
    if (lines[i].trimStart().startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].trimStart().startsWith("- ")) {
        items.push(lines[i].trimStart().slice(2));
        i++;
      }
      blocks.push(
        <ul key={`${keyPrefix}ul${blockKey}`} className="my-1.5 flex flex-col gap-1.5">
          {items.map((it, idx) => (
            <li key={idx} className="flex gap-2">
              <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-brand-emerald" />
              <span>{renderInline(it, `${keyPrefix}uli${blockKey}-${idx}`)}</span>
            </li>
          ))}
        </ul>
      );
      blockKey++;
    } else {
      const paraLines: string[] = [];
      while (i < lines.length && lines[i].trim() !== "" && !lines[i].trimStart().startsWith("- ")) {
        paraLines.push(lines[i]);
        i++;
      }
      blocks.push(
        <p key={`${keyPrefix}p${blockKey}`} className="my-1.5 first:mt-0 last:mb-0">
          {renderInline(paraLines.join("\n"), `${keyPrefix}p${blockKey}`)}
        </p>
      );
      blockKey++;
    }
  }
  return blocks;
}

export function renderMessageContent(text: string) {
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  MARKER.lastIndex = 0;
  let key = 0;
  while ((m = MARKER.exec(text))) {
    // ProductChip already carries its own top/bottom margin, so any blank
    // lines the model left right next to a marker would double up the gap —
    // trim newline runs at both ends of each text segment, not just one.
    const before = text.slice(last, m.index).replace(/^\n+|\n+$/g, "");
    if (before) out.push(...renderTextBlock(before, `t${key++}-`));
    out.push(<ProductChip key={`p${key++}`} slug={m[1] || m[2] || m[3]} />);
    last = m.index + m[0].length;
  }
  const tail = text.slice(last).replace(/^\n+/, "");
  if (tail) out.push(...renderTextBlock(tail, `t${key++}-`));
  return out;
}
