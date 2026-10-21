"use client";

import { useRef } from "react";
import SmoothieRig, { type SmoothieRigHandle } from "@/components/mascot/SmoothieRig";
import { useLang } from "@/lib/lang-context";

// Every move the storefront can ask Smoothie for, so the team can see them in
// one place. Moods that would look upset to a shopper (sad, angry) are not in
// the rig at all — see smoothie-anims.ts.
const GESTURES: [string, string, string][] = [
  ["wave", "ทักทาย", "Wave"],
  ["nod", "พยักหน้า", "Nod"],
  ["shake", "ส่ายหน้า", "Shake head"],
  ["jump", "กระโดด", "Jump"],
  ["talk", "พูด", "Talk"],
  ["think", "คิด", "Think"],
  ["dance", "เต้น", "Dance"],
  ["run", "วิ่ง", "Run"],
  ["party", "เต้นเฟี้ยว", "Party"],
  ["brazil", "บราซิล", "Brazil"],
];
const MOODS: [string, string, string][] = [
  ["happy", "ดีใจ", "Happy"],
  ["laugh", "หัวเราะ", "Laugh"],
  ["surprised", "ตกใจ", "Surprised"],
  ["curious", "สงสัย", "Curious"],
  ["worried", "กังวล", "Worried"],
];

export default function MascotShowcase() {
  const { t } = useLang();
  const rig = useRef<SmoothieRigHandle>(null);
  const row = (title: string, items: [string, string, string][]) => (
    <div className="flex flex-col items-center gap-2">
      <p className="text-xs font-semibold tracking-wide text-slate-500">{title}</p>
      <div className="flex flex-wrap justify-center gap-2">
        {items.map(([id, th, en]) => (
          <button
            key={id}
            type="button"
            onClick={() => rig.current?.play(id)}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 transition-colors hover:border-brand-teal hover:text-brand-800 focus-visible:outline-2 focus-visible:outline-brand-teal active:scale-95"
          >
            {t(th, en)}
          </button>
        ))}
      </div>
    </div>
  );
  return (
    <div className="container-page flex flex-col items-center gap-6 py-8 md:py-12">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-brand-ink md:text-3xl">{t("น้อง Smoothie", "Meet Smoothie")}</h1>
        <p className="mt-1 text-sm text-slate-500">{t("กดปุ่มหรือแตะที่น้องเพื่อดูท่าทาง", "Tap a button or Smoothie to see a move")}</p>
      </div>
      <SmoothieRig ref={rig} className="aspect-[1100/1180] w-full max-w-[380px]" shadow alt={t("น้อง Smoothie มาสคอตของ Smoothlife", "Smoothie, the Smoothlife mascot")} />
      <div className="flex w-full max-w-xl flex-col gap-5">
        {row(t("ท่าทาง", "Moves"), GESTURES)}
        {row(t("อารมณ์", "Moods"), MOODS)}
      </div>
    </div>
  );
}
