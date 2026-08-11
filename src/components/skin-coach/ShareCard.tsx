"use client";

import { useRef, useState } from "react";
import { Share2, Loader2 } from "lucide-react";
import { SkinCoachMetrics, overallScore, scoreBand } from "@/lib/skin-coach";

const BRAND = {
  emerald: "#00A87B",
  teal: "#00B39B",
  sky: "#00AEEF",
  blue: "#0091E6",
  ink: "#0F172A",
  slate: "#64748B",
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, alpha: number) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.lineTo(x + size * 0.28, y - size * 0.28);
  ctx.lineTo(x + size, y);
  ctx.lineTo(x + size * 0.28, y + size * 0.28);
  ctx.lineTo(x, y + size);
  ctx.lineTo(x - size * 0.28, y + size * 0.28);
  ctx.lineTo(x - size, y);
  ctx.lineTo(x - size * 0.28, y - size * 0.28);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines = 2) {
  const words = text.split(" ");
  let line = "";
  let lines: string[] = [];
  for (const word of words) {
    const test = line ? line + " " + word : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  lines = lines.slice(0, maxLines);
  const startY = y - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((l, i) => ctx.fillText(l, x, startY + i * lineHeight));
  return lines.length;
}

async function drawSkinCoachCard(canvas: HTMLCanvasElement, metrics: SkinCoachMetrics, photoDataUrl: string, zones: string[]) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = 1080;
  const H = 1350;
  canvas.width = W;
  canvas.height = H;

  const total = overallScore(metrics);
  const band = scoreBand(total);

  // 1. Bold full-bleed diagonal gradient background.
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#003D33");
  bg.addColorStop(0.45, BRAND.emerald);
  bg.addColorStop(1, BRAND.sky);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Soft glow blobs for depth.
  ctx.save();
  ctx.globalAlpha = 0.35;
  const glow1 = ctx.createRadialGradient(W * 0.15, H * 0.08, 0, W * 0.15, H * 0.08, 420);
  glow1.addColorStop(0, "#ffffff");
  glow1.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow1;
  ctx.beginPath();
  ctx.arc(W * 0.15, H * 0.08, 420, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Scattered sparkles across the background.
  const sparklePositions = [
    [90, 90, 10, 0.9],
    [960, 70, 7, 0.7],
    [1000, 260, 12, 0.5],
    [60, 640, 8, 0.5],
    [1010, 1120, 9, 0.6],
    [70, 1240, 11, 0.6],
    [520, 40, 6, 0.6],
  ];
  sparklePositions.forEach(([x, y, s, a]) => sparkle(ctx, x, y, s, a));

  // 2. Glass content card.
  const pad = 56;
  const cardX = pad;
  const cardY = 132;
  const cardW = W - pad * 2;
  const cardH = H - cardY - pad;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 60;
  ctx.shadowOffsetY = 24;
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, cardX, cardY, cardW, cardH, 44);
  ctx.fill();
  ctx.restore();

  // Top badge pill.
  ctx.textAlign = "center";
  const badgeText = "✨ SMOOTHIE SKIN REPORT";
  ctx.font = "700 22px sans-serif";
  const badgeW = ctx.measureText(badgeText).width + 56;
  ctx.save();
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, W / 2 - badgeW / 2, 36, badgeW, 52, 26);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = BRAND.emerald;
  ctx.fillText(badgeText, W / 2, 71);

  // Wordmark inside the card.
  let y = cardY + 66;
  ctx.fillStyle = BRAND.ink;
  ctx.font = "800 32px sans-serif";
  ctx.fillText("Smooth Life", W / 2, y);
  ctx.font = "600 18px sans-serif";
  ctx.fillStyle = BRAND.slate;
  ctx.fillText("Skin Coach by Smoothie", W / 2, y + 26);

  // Hero photo with gradient ring + score badge.
  const cx = W / 2;
  const cy = cardY + 230;
  const r = 128;
  const ringGrad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  ringGrad.addColorStop(0, BRAND.emerald);
  ringGrad.addColorStop(0.5, BRAND.teal);
  ringGrad.addColorStop(1, BRAND.sky);
  ctx.save();
  ctx.shadowColor = `${BRAND.teal}66`;
  ctx.shadowBlur = 36;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 12, 0, Math.PI * 2);
  ctx.fillStyle = ringGrad;
  ctx.fill();
  ctx.restore();

  try {
    const img = await loadImage(photoDataUrl);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    const scale = Math.max((r * 2) / img.width, (r * 2) / img.height);
    const iw = img.width * scale;
    const ih = img.height * scale;
    ctx.drawImage(img, cx - iw / 2, cy - ih / 2, iw, ih);
    ctx.restore();
  } catch {
    ctx.fillStyle = "#F4FAF8";
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Score badge overlapping the ring, bottom-right.
  const bx = cx + r * 0.72;
  const by = cy + r * 0.72;
  ctx.save();
  ctx.shadowColor = "rgba(15,23,42,0.25)";
  ctx.shadowBlur = 16;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(bx, by, 46, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = band.hex;
  ctx.font = "800 26px sans-serif";
  ctx.fillText(String(total), bx, by + 4);
  ctx.font = "600 12px sans-serif";
  ctx.fillStyle = BRAND.slate;
  ctx.fillText("/100", bx, by + 22);

  // Skin age headline.
  y = cy + r + 92;
  ctx.font = "600 22px sans-serif";
  ctx.fillStyle = BRAND.slate;
  ctx.fillText("อายุผิวโดยประมาณ", cx, y);

  y += 96;
  ctx.save();
  ctx.shadowColor = "rgba(0,168,123,0.25)";
  ctx.shadowBlur = 20;
  const numGrad = ctx.createLinearGradient(cx - 140, y - 60, cx + 140, y);
  numGrad.addColorStop(0, BRAND.emerald);
  numGrad.addColorStop(1, BRAND.blue);
  ctx.fillStyle = numGrad;
  ctx.font = "800 96px sans-serif";
  ctx.fillText(`${metrics.skinAge.years} ปี`, cx, y);
  ctx.restore();

  y += 42;
  ctx.font = "italic 20px sans-serif";
  ctx.fillStyle = BRAND.emerald;
  const noteLines = wrapText(ctx, metrics.skinAge.note, cx, y, cardW - 160, 26);
  y += (noteLines - 1) * 13;

  // Zones-scanned chip row.
  if (zones.length > 0) {
    y += 44;
    ctx.font = "600 16px sans-serif";
    const chipText = zones.join("  •  ");
    ctx.fillStyle = BRAND.slate;
    wrapText(ctx, `สแกน: ${chipText}`, cx, y, cardW - 140, 22);
  }

  // Metric bars.
  const metricRows: [string, { score: number }][] = [
    ["ความเรียบเนียนผิว (สิว)", metrics.acne],
    ["รูขุมขน", metrics.pores],
    ["จุดด่างดำ", metrics.darkSpots],
    ["ริ้วรอย", metrics.wrinkles],
  ];
  let by2 = y + 56;
  const barX = cardX + 70;
  const barW = cardW - 140;
  metricRows.forEach(([label, m]) => {
    const clarity = Math.max(0, Math.min(100, 100 - m.score));
    ctx.textAlign = "left";
    ctx.font = "700 19px sans-serif";
    ctx.fillStyle = BRAND.emerald;
    ctx.fillText("●", barX, by2);
    ctx.fillStyle = BRAND.ink;
    ctx.font = "600 19px sans-serif";
    ctx.fillText(label, barX + 20, by2);
    ctx.textAlign = "right";
    ctx.fillStyle = BRAND.emerald;
    ctx.font = "700 19px sans-serif";
    ctx.fillText(`${clarity}/100`, barX + barW, by2);

    const trackY = by2 + 14;
    ctx.fillStyle = "#EEF3F2";
    roundRect(ctx, barX, trackY, barW, 14, 7);
    ctx.fill();
    const fillGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    fillGrad.addColorStop(0, BRAND.emerald);
    fillGrad.addColorStop(1, BRAND.sky);
    ctx.fillStyle = fillGrad;
    roundRect(ctx, barX, trackY, Math.max(14, (barW * clarity) / 100), 14, 7);
    ctx.fill();

    by2 += 58;
  });

  // Footer CTA + disclaimer.
  ctx.textAlign = "center";
  ctx.font = "800 26px sans-serif";
  ctx.fillStyle = BRAND.ink;
  ctx.fillText("✨ สแกนผิวฟรีที่ Smoothlife.com ✨", cx, cardY + cardH - 62);
  ctx.font = "15px sans-serif";
  ctx.fillStyle = BRAND.slate;
  wrapText(ctx, metrics.disclaimer, cx, cardY + cardH - 28, cardW - 140, 19);
}

export default function ShareCard({
  metrics,
  photoDataUrl,
  zones,
}: {
  metrics: SkinCoachMetrics;
  photoDataUrl: string;
  zones: string[];
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [busy, setBusy] = useState(false);

  async function buildBlob(): Promise<Blob | null> {
    if (!canvasRef.current) return null;
    await drawSkinCoachCard(canvasRef.current, metrics, photoDataUrl, zones);
    return new Promise((resolve) => canvasRef.current!.toBlob((b) => resolve(b), "image/png"));
  }

  async function handleShare() {
    setBusy(true);
    try {
      const blob = await buildBlob();
      if (!blob) return;
      const file = new File([blob], "smoothlife-skin-coach.png", { type: "image/png" });

      if (typeof navigator !== "undefined" && (navigator as any).canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "Smooth Life — Skin Coach by Smoothie",
          text: `อายุผิวของฉันประมาณ ${metrics.skinAge.years} ปี! สแกนผิวฟรีที่ Smoothlife.com`,
        });
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "smoothlife-skin-coach.png";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // user cancelled share sheet or an error occurred — no-op
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <canvas ref={canvasRef} className="hidden" />
      <button
        disabled={busy}
        onClick={handleShare}
        className="flex items-center gap-2 rounded-full border border-brand-teal text-brand-emerald font-semibold px-5 py-2.5 text-xs disabled:opacity-60"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
        แชร์ผลลัพธ์
      </button>
    </div>
  );
}
