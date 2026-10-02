"use client";

import { useRef } from "react";
import { Bold, Italic, List } from "lucide-react";

// A textarea that can make text bold, italic, or a list — and nothing else.
//
// The buttons wrap the selection in the markers that lib/rich-text renders, so
// what is stored stays plain text and what is typed by hand keeps working.
// Pressing bold with nothing selected drops the markers in and puts the cursor
// between them, which is what every editor does and what a person expects.

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
};

export default function RichTextArea({ value, onChange, placeholder, rows = 4, className = "" }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function surround(marker: string) {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? start;
    const selected = value.slice(start, end);
    const next = `${value.slice(0, start)}${marker}${selected}${marker}${value.slice(end)}`;
    onChange(next);
    // Put the caret where the writing continues: inside empty markers, or
    // after the text that was just wrapped.
    requestAnimationFrame(() => {
      el.focus();
      const caret = selected ? end + marker.length * 2 : start + marker.length;
      el.setSelectionRange(caret, caret);
    });
  }

  function bulletLines() {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? start;
    // Whole lines, not half of one: a list marker belongs at the start of the
    // line the selection touches.
    const from = value.lastIndexOf("\n", start - 1) + 1;
    const toRaw = value.indexOf("\n", end);
    const to = toRaw === -1 ? value.length : toRaw;
    const block = value.slice(from, to);
    const already = block.split("\n").every((l) => /^\s*[-•]\s/.test(l) || !l.trim());
    const changed = block
      .split("\n")
      .map((l) => (already ? l.replace(/^\s*[-•]\s+/, "") : l.trim() ? `- ${l.replace(/^\s*[-•]\s+/, "")}` : l))
      .join("\n");
    const next = `${value.slice(0, from)}${changed}${value.slice(to)}`;
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const caret = from + changed.length;
      el.setSelectionRange(caret, caret);
    });
  }

  const button =
    "grid size-7 place-items-center rounded-md text-slate-500 transition-colors hover:bg-black/5 hover:text-brand-ink";

  return (
    <div className={`rounded-l border border-surface-line bg-white focus-within:border-brand-800 ${className}`}>
      <div className="flex items-center gap-0.5 border-b border-surface-line px-1.5 py-1">
        <button type="button" onClick={() => surround("**")} title="ตัวหนา" aria-label="ตัวหนา" className={button}>
          <Bold size={14} aria-hidden />
        </button>
        <button type="button" onClick={() => surround("*")} title="ตัวเอียง" aria-label="ตัวเอียง" className={button}>
          <Italic size={14} aria-hidden />
        </button>
        <button type="button" onClick={bulletLines} title="หัวข้อย่อย" aria-label="หัวข้อย่อย" className={button}>
          <List size={14} aria-hidden />
        </button>
        <span className="ms-auto pe-1 text-[10px] text-slate-400">**หนา** · *เอียง* · ขึ้นบรรทัดด้วย - คือหัวข้อย่อย</span>
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full resize-y rounded-b-l bg-transparent px-3 py-2 text-[13px] text-brand-ink outline-hidden placeholder:text-slate-400"
      />
    </div>
  );
}
