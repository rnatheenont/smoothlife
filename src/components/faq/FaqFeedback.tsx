"use client";

import { useState } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import clsx from "clsx";

// "Was this helpful?" — and, when it was not, which kind of not.
//
// A bare thumbs-down says an answer failed without saying how, and the three
// reasons are the three different jobs: the wrong question was matched, the
// right question was matched but the answer stops too early, or the answer is
// wrong. The first is a search problem, the second a writing problem, the
// third something a person has to correct today.
//
// Nothing here blocks on the request. A reader who taps and scrolls away has
// given their answer; whether the row reached the database is the site's
// problem, not theirs.

const REASONS = [
  { key: "wrong-question", label: "ไม่ตรงคำถาม" },
  { key: "not-enough", label: "ข้อมูลไม่พอ" },
  { key: "incorrect", label: "ข้อมูลผิด" },
] as const;

export default function FaqFeedback({ articleId }: { articleId: string }) {
  const [voted, setVoted] = useState<"up" | "down" | null>(null);
  const [done, setDone] = useState(false);

  function send(helpful: boolean, reason?: string) {
    fetch("/api/faq/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ article_id: articleId, helpful, reason }),
      keepalive: true,
    }).catch(() => {
      // Deliberately silent. Telling somebody their thumbs-up failed to save
      // is worse than losing the thumbs-up.
    });
  }

  if (done) {
    return <p className="text-sm text-slate-500">ขอบคุณค่ะ ทีมงานจะนำไปปรับปรุง</p>;
  }

  if (voted === "down") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate-500">ส่วนไหนที่ยังไม่ช่วย</span>
        {REASONS.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => {
              send(false, r.key);
              setDone(true);
            }}
            className="rounded-full bg-surface-soft px-3 py-1.5 text-xs font-medium text-brand-800 ring-1 ring-surface-line hover:ring-brand-800/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-800"
          >
            {r.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-slate-500">มีประโยชน์ไหม</span>
      <button
        type="button"
        aria-label="คำตอบนี้มีประโยชน์"
        onClick={() => {
          send(true);
          setVoted("up");
          setDone(true);
        }}
        className={clsx(
          "flex h-9 w-9 items-center justify-center rounded-full ring-1 ring-surface-line transition-colors hover:text-brand-800 hover:ring-brand-800/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-800",
          voted === "up" ? "text-brand-800" : "text-slate-500"
        )}
      >
        <ThumbsUp className="h-4 w-4" aria-hidden />
      </button>
      <button
        type="button"
        aria-label="คำตอบนี้ยังไม่ช่วย"
        onClick={() => setVoted("down")}
        className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 ring-1 ring-surface-line transition-colors hover:text-brand-800 hover:ring-brand-800/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-800"
      >
        <ThumbsDown className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
