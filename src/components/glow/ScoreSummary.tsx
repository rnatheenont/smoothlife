"use client";

import { useRef } from "react";
import { Download, Trash2 } from "lucide-react";
import { DayEntry, useGlowChallenge } from "@/lib/glow-challenge-context";

function ScoreRow({ label, score }: { label: string; score: number }) {
  const clarity = Math.max(0, Math.min(100, 100 - score));
  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs text-slate-500 mb-1">
        <span>{label}</span>
        <span className="font-semibold text-brand-ink">{clarity}/100</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full bg-brand-gradient rounded-full" style={{ width: `${clarity}%` }} />
      </div>
    </div>
  );
}

function LatestEntry({ entry }: { entry: DayEntry }) {
  return (
    <div className="rounded-xl2 border border-slate-100 shadow-card p-6 mb-6">
      <div className="flex items-center gap-4 mb-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={entry.thumbDataUrl} alt={`รูปวันที่ ${entry.day}`} className="h-16 w-16 rounded-full object-cover" />
        <div>
          <h3 className="font-bold text-brand-ink">ผลวันที่ {entry.day}</h3>
          <p className="text-xs text-slate-400">{new Date(entry.capturedAt).toLocaleDateString("th-TH")}</p>
        </div>
      </div>
      <ScoreRow label="ความเรียบเนียนของผิว (สิว)" score={entry.result.acne.score} />
      <ScoreRow label="ความสม่ำเสมอของสีผิว (จุดด่างดำ)" score={entry.result.darkSpots.score} />
      <ScoreRow label="ความเรียบเนียน (ริ้วรอย)" score={entry.result.wrinkles.score} />
      <p className="text-sm text-slate-600 mt-4">{entry.result.overallNote}</p>
      <p className="text-[11px] text-slate-400 mt-3 border-t border-slate-100 pt-3">{entry.result.disclaimer}</p>
    </div>
  );
}

async function drawShareCard(canvas: HTMLCanvasElement, day1: DayEntry, latest: DayEntry) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = 800;
  const H = 1000;
  canvas.width = W;
  canvas.height = H;

  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, "#E6FBF5");
  grad.addColorStop(1, "#E6F6FE");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#0F172A";
  ctx.font = "bold 40px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Glow Challenge 7 Days", W / 2, 90);
  ctx.font = "20px sans-serif";
  ctx.fillStyle = "#00A87B";
  ctx.fillText("smoothlife.com", W / 2, 125);

  const loadImg = (src: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });

  const [img1, img2] = await Promise.all([loadImg(day1.thumbDataUrl), loadImg(latest.thumbDataUrl)]);

  function circleImg(img: HTMLImageElement, cx: number, cy: number, r: number) {
    ctx!.save();
    ctx!.beginPath();
    ctx!.arc(cx, cy, r, 0, Math.PI * 2);
    ctx!.closePath();
    ctx!.clip();
    ctx!.drawImage(img, cx - r, cy - r, r * 2, r * 2);
    ctx!.restore();
    ctx!.strokeStyle = "#ffffff";
    ctx!.lineWidth = 6;
    ctx!.beginPath();
    ctx!.arc(cx, cy, r, 0, Math.PI * 2);
    ctx!.stroke();
  }

  circleImg(img1, W / 2 - 150, 260, 100);
  circleImg(img2, W / 2 + 150, 260, 100);

  ctx.font = "bold 16px sans-serif";
  ctx.fillStyle = "#0F172A";
  ctx.fillText(`วันที่ ${day1.day}`, W / 2 - 150, 390);
  ctx.fillText(`วันที่ ${latest.day}`, W / 2 + 150, 390);

  const metrics: [string, "acne" | "darkSpots" | "wrinkles"][] = [
    ["สิว", "acne"],
    ["จุดด่างดำ", "darkSpots"],
    ["ริ้วรอย", "wrinkles"],
  ];

  let y = 460;
  metrics.forEach(([label, key]) => {
    const before = Math.max(0, 100 - day1.result[key].score);
    const after = Math.max(0, 100 - latest.result[key].score);
    const delta = after - before;

    ctx.textAlign = "left";
    ctx.font = "bold 22px sans-serif";
    ctx.fillStyle = "#0F172A";
    ctx.fillText(label, 80, y);

    ctx.textAlign = "right";
    ctx.fillStyle = delta >= 0 ? "#00A87B" : "#0091E6";
    ctx.fillText(`${before} → ${after} (${delta >= 0 ? "+" : ""}${delta})`, W - 80, y);

    y += 60;
  });

  ctx.textAlign = "center";
  ctx.font = "italic 14px sans-serif";
  ctx.fillStyle = "#64748B";
  ctx.fillText("ผลประเมินเบื้องต้นเพื่อความสวยงามจากภาพถ่าย ไม่ใช่การวินิจฉัยทางการแพทย์", W / 2, H - 60);
}

export default function ScoreSummary() {
  const { entries, resetAll } = useGlowChallenge();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const days = Object.keys(entries)
    .map(Number)
    .sort((a, b) => a - b);
  if (days.length === 0) return null;

  const day1 = entries[days[0]];
  const latest = entries[days[days.length - 1]];
  const hasComparison = days.length > 1;

  async function handleDownload() {
    if (!canvasRef.current) return;
    await drawShareCard(canvasRef.current, day1, latest);
    const url = canvasRef.current.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `smoothlife-glow-challenge-day${latest.day}.png`;
    a.click();
  }

  return (
    <div>
      <LatestEntry entry={latest} />

      {hasComparison && (
        <div className="rounded-xl2 border border-slate-100 shadow-card p-6 mb-6 text-center">
          <h3 className="font-bold text-brand-ink mb-1">เปรียบเทียบวันที่ {day1.day} กับวันที่ {latest.day}</h3>
          <p className="text-xs text-slate-500 mb-5">บันทึกภาพผลลัพธ์เพื่อแชร์ได้เลย</p>
          <canvas ref={canvasRef} className="hidden" />
          <button
            onClick={handleDownload}
            className="inline-flex items-center gap-2 rounded-full bg-brand-gradient text-white font-semibold px-6 py-3 text-sm"
          >
            <Download size={16} />
            บันทึกรูปสรุปผล
          </button>
        </div>
      )}

      <button
        onClick={() => {
          if (confirm("ต้องการลบข้อมูล Glow Challenge ทั้งหมดในเบราว์เซอร์นี้ใช่หรือไม่?")) resetAll();
        }}
        className="mx-auto flex items-center gap-2 text-xs text-slate-400 hover:text-red-500 mt-2"
      >
        <Trash2 size={14} />
        ลบข้อมูลทั้งหมด
      </button>
    </div>
  );
}
