"use client";

import clsx from "clsx";
import { AGE_RANGES, MAIN_CONCERNS, SKIN_TYPES, type ScanAnswers } from "@/lib/skin-coach";
import { Button } from "@/components/ui";

function ChoiceGroup<K extends string>({
  legend,
  hint,
  options,
  value,
  onChange,
}: {
  legend: string;
  hint: string;
  options: readonly { key: K; label: string }[];
  value?: K;
  onChange: (value: K | undefined) => void;
}) {
  return (
    <fieldset className="border-t border-surface-line pt-4 first:border-t-0 first:pt-0">
      <legend className="text-sm font-semibold text-brand-ink">{legend}</legend>
      <p className="mt-0.5 text-xs text-slate-600">{hint}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((o) => {
          const selected = value === o.key;
          return (
            <button
              key={o.key}
              type="button"
              aria-pressed={selected}
              // Tapping the chosen one again clears it — the question stays optional.
              onClick={() => onChange(selected ? undefined : o.key)}
              className={clsx(
                "rounded-full border px-4 py-2 text-sm transition-colors",
                selected
                  ? "border-brand-800 bg-brand-800 font-semibold text-white"
                  : "border-surface-line bg-white text-slate-700 hover:border-brand-800/40"
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export default function QuestionsStep({
  answers,
  error,
  onChange,
  onSubmit,
}: {
  answers: ScanAnswers;
  error: string | null;
  onChange: (patch: Partial<ScanAnswers>) => void;
  onSubmit: () => void;
}) {
  const answered = Object.values(answers).some(Boolean);

  return (
    <section>
      <h2 className="text-lg font-bold text-brand-ink md:text-xl">เล่าเรื่องผิวให้ฟังนิดนึง</h2>
      <p className="mt-1 text-sm text-slate-600">
        ตอบเฉพาะข้อที่อยากตอบ ช่วยให้อ่านผลและแนะนำสินค้าได้ตรงขึ้น ไม่ได้ส่งไปกับรูป
      </p>

      <div className="mt-5 space-y-4 rounded-xl2 border border-surface-line p-4 sm:p-5">
        <ChoiceGroup
          legend="ช่วงอายุของคุณ"
          hint="ใช้เทียบกับอายุผิวที่สแกนได้"
          options={AGE_RANGES}
          value={answers.ageRange}
          onChange={(ageRange) => onChange({ ageRange })}
        />
        <ChoiceGroup
          legend="สภาพผิวโดยทั่วไป"
          hint="ใช้เลือกสินค้าให้เข้ากับผิว"
          options={SKIN_TYPES}
          value={answers.skinType}
          onChange={(skinType) => onChange({ skinType })}
        />
        <ChoiceGroup
          legend="เรื่องที่กังวลที่สุด"
          hint="สินค้าที่แนะนำจะเริ่มจากเรื่องนี้"
          options={MAIN_CONCERNS}
          value={answers.mainConcern}
          onChange={(mainConcern) => onChange({ mainConcern })}
        />
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
          {error}
        </p>
      )}

      <div className="mt-5 flex flex-col gap-2.5">
        <Button size="lg" onClick={onSubmit}>
          ดูผลสแกนผิว
        </Button>
        {!answered && (
          <button type="button" onClick={onSubmit} className="py-1 text-center text-sm text-slate-600 hover:text-brand-ink">
            ข้ามคำถาม ดูผลเลย
          </button>
        )}
      </div>
    </section>
  );
}
