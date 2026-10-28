"use client";

import { useEffect, useState } from "react";

/**
 * A deadline, counting down to the second.
 *
 * Its own component with its own interval, not a tick on the page: at one
 * second a page-level counter would re-render eighty product cards a
 * second to move two digits. Here React re-renders this span and nothing
 * else.
 *
 * Starts at null and fills in after mount. The server has no business
 * rendering a clock — the HTML it produced would be cached and served as
 * "เหลือ 6 วัน" long after it was six days, and React would complain about
 * the mismatch when it corrected it.
 *
 * Units with a leading zero are dropped, so a thirty-minute payment window
 * reads "เหลือ 28 นาที 14 วิ" rather than "0 วัน 0 ชม. 28 นาที 14 วิ".
 *
 * `daysOnly` is for tight spots like the header: "เหลือ 17 วัน" while there
 * is a day or more, and the full clock only on the last day.
 */
export default function Countdown({
  to,
  className,
  daysOnly = false,
}: {
  to: string;
  className?: string;
  daysOnly?: boolean;
}) {
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    const end = new Date(to).getTime();
    const update = () => setLeft(Math.max(0, end - Date.now()));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [to]);

  if (left === null) return null;
  if (left <= 0) return <span className={className}>หมดเวลาแล้ว</span>;

  const total = Math.floor(left / 1000);
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3_600);
  const mins = Math.floor((total % 3_600) / 60);
  const secs = total % 60;

  const parts = daysOnly && days > 0 ? [`${days} วัน`] : [
    days > 0 ? `${days} วัน` : null,
    days > 0 || hours > 0 ? `${hours} ชม.` : null,
    days > 0 || hours > 0 || mins > 0 ? `${mins} นาที` : null,
    `${secs} วิ`,
  ].filter(Boolean);

  return (
    // tabular-nums so the line does not shuffle sideways every second as the
    // digits change width.
    <span className={`tabular-nums ${className ?? ""}`}>
      เหลือ {parts.join(" ")}
    </span>
  );
}
