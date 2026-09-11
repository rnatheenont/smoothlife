"use client";

import clsx from "clsx";
import { AGE_RANGES, CONCERNS, MAX_CONCERNS, SKIN_TYPES, type ScanAnswers } from "@/lib/skin-coach";
import { Button } from "@/components/ui";

type Option<K extends string> = { key: K; label: string };

function Chip({ selected, disabled, onClick, children }: { selected: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        "rounded-full border px-4 py-2 text-sm transition-colors disabled:opacity-40",
        selected
          ? "border-brand-800 bg-brand-800 font-semibold text-white"
          : "border-surface-line bg-white text-slate-700 hover:border-brand-800/40"
      )}
    >
      {children}
    </button>
  );
}

function Group({ legend, hint, children }: { legend: string; hint: string; children: React.ReactNode }) {
  return (
    <fieldset className="border-t border-surface-line pt-4 first:border-t-0 first:pt-0">
      <legend className="text-sm font-semibold text-brand-ink">{legend}</legend>
      <p className="mt-0.5 text-xs text-slate-600">{hint}</p>
      <div className="mt-3 flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

/** One answer; tapping the chosen one again clears it — the question stays optional. */
function SingleChoice<K extends string>({ options, value, onChange }: { options: readonly Option<K>[]; value?: K; onChange: (v: K | undefined) => void }) {
  return (
    <>
      {options.map((o) => (
        <Chip key={o.key} selected={value === o.key} onClick={() => onChange(value === o.key ? undefined : o.key)}>
          {o.label}
        </Chip>
      ))}
    </>
  );
}

/** Several answers, up to `max`; the rest grey out once the limit is reached. */
function MultiChoice<K extends string>({
  options,
  value = [],
  max,
  onChange,
}: {
  options: readonly Option<K>[];
  value?: K[];
  max?: number;
  onChange: (v: K[]) => void;
}) {
  const full = max !== undefined && value.length >= max;
  return (
    <>
      {options.map((o) => {
        const selected = value.includes(o.key);
        return (
          <Chip
            key={o.key}
            selected={selected}
            disabled={!selected && full}
            onClick={() => onChange(selected ? value.filter((k) => k !== o.key) : [...value, o.key])}
          >
            {o.label}
          </Chip>
        );
      })}
    </>
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
  const answered = Boolean(answers.ageRange || answers.skinTypes?.length || answers.concerns?.length);

  return (
    <section>
      <h2 className="text-lg font-bold text-brand-ink md:text-xl">เล่าเรื่องผิวให้ฟังนิดนึง</h2>
      <p className="mt-1 text-sm text-slate-600">
        ตอบเฉพาะข้อที่อยากตอบ ช่วยให้อ่านผลและแนะนำสินค้าได้ตรงขึ้น ไม่ได้ส่งไปกับรูป
      </p>

      <div className="mt-5 space-y-4 rounded-xl2 border border-surface-line p-4 sm:p-5">
        <Group legend="ช่วงอายุของคุณ" hint="ใช้เทียบกับอายุผิวที่สแกนได้">
          <SingleChoice options={AGE_RANGES} value={answers.ageRange} onChange={(ageRange) => onChange({ ageRange })} />
        </Group>
        <Group legend="สภาพผิวโดยทั่วไป" hint="เลือกได้มากกว่า 1 ข้อ ใช้เลือกสินค้าให้เข้ากับผิว">
          <MultiChoice options={SKIN_TYPES} value={answers.skinTypes} onChange={(skinTypes) => onChange({ skinTypes })} />
        </Group>
        <Group legend="เรื่องที่กังวล" hint={`เลือกได้สูงสุด ${MAX_CONCERNS} ข้อ สินค้าที่แนะนำจะเริ่มจากเรื่องเหล่านี้`}>
          <MultiChoice options={CONCERNS} value={answers.concerns} max={MAX_CONCERNS} onChange={(concerns) => onChange({ concerns })} />
        </Group>
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
