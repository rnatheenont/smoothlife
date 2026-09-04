"use client";

import config from "../../../../tailwind.config";

// A living style guide: it reads the real tailwind.config, so it cannot drift
// from what the code actually ships. A design system that lives only in a
// document describes what someone intended a few months ago; this describes
// what a class name will do right now.

type Theme = {
  colors: Record<string, Record<string | number, string>>;
  fontSize: Record<string, [string, { lineHeight?: string; letterSpacing?: string }]>;
  borderRadius: Record<string, string>;
  boxShadow: Record<string, string>;
  spacing: Record<string, string>;
};
const theme = (config.theme?.extend ?? {}) as unknown as Theme;

/* ---- contrast, computed rather than eyeballed ---- */

function parseColor(c: string): [number, number, number] | null {
  if (c.startsWith("#") && c.length === 7) {
    return [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) as [number, number, number];
  }
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const [r, g, b] = m[1].split(",").map((v) => parseFloat(v));
  return [r, g, b];
}
function luminance([r, g, b]: [number, number, number]) {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrastOnWhite(c: string): number | null {
  const rgb = parseColor(c);
  if (!rgb) return null;
  const l = luminance(rgb);
  return (1.05) / (l + 0.05);
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-title font-bold text-brand-ink">{title}</h2>
      {hint && <p className="mt-0.5 mb-3 text-body-xs text-slate-500">{hint}</p>}
      {children}
    </section>
  );
}

export default function AdminDesignSystemPage() {
  const colorGroups = Object.entries(theme.colors ?? {});

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-brand-ink">ระบบดีไซน์</h1>
        <p className="mt-1 text-body-s text-slate-500">
          อ่านค่าจาก <code className="rounded bg-surface-soft px-1">tailwind.config.ts</code> โดยตรง —
          หน้านี้จึงตรงกับของจริงเสมอ ไม่มีทางเพี้ยน
        </p>
      </div>

      <Section
        title="สี"
        hint="ตัวเลขคือ contrast เทียบพื้นขาว — WCAG AA ต้องการ 4.5 สำหรับตัวอักษรปกติ และ 3.0 สำหรับตัวใหญ่/องค์ประกอบ UI"
      >
        {colorGroups.map(([group, shades]) => (
          <div key={group} className="mb-4">
            <p className="mb-1.5 text-label font-semibold uppercase tracking-wide text-slate-400">{group}</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(shades).map(([step, value]) => {
                const ratio = contrastOnWhite(value);
                const readable = ratio !== null && ratio >= 4.5;
                return (
                  <div key={step} className="w-28">
                    <div className="h-12 rounded-m shadow-layer-xs" style={{ background: value }} />
                    <p className="mt-1 text-body-xs font-semibold text-brand-ink">
                      {group}-{step}
                    </p>
                    <p className="text-[10px] text-slate-400">{value}</p>
                    {ratio !== null && (
                      <p className={`text-[10px] ${readable ? "text-brand-800" : "text-slate-400"}`}>
                        {ratio.toFixed(2)} {readable ? "· อ่านได้" : "· พื้น/UI เท่านั้น"}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </Section>

      <Section title="ตัวอักษร" hint="ชื่อคลาสใช้ได้เลย เช่น text-h3, text-body-s">
        <div className="flex flex-col gap-2 rounded-l border border-slate-100 p-4">
          {Object.entries(theme.fontSize ?? {}).map(([name, [size, opts]]) => (
            <div key={name} className="flex items-baseline gap-4 border-b border-slate-50 pb-2 last:border-0">
              <code className="w-24 shrink-0 text-[11px] text-slate-400">text-{name}</code>
              <span
                className="min-w-0 truncate text-brand-ink"
                style={{ fontSize: size, lineHeight: opts?.lineHeight, letterSpacing: opts?.letterSpacing }}
              >
                สวัสดี Smoothlife
              </span>
              <span className="ml-auto shrink-0 text-[10px] text-slate-400">{size}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="ความโค้งมุม" hint="xl / 2xl / 3xl ตั้งใจไม่ทับของ Tailwind เพราะเว็บใช้อยู่ 62 จุด">
        <div className="flex flex-wrap gap-3">
          {Object.entries(theme.borderRadius ?? {}).map(([name, value]) => (
            <div key={name} className="text-center">
              <div
                className="h-16 w-16 border border-brand-200 bg-brand-50"
                style={{ borderRadius: value }}
              />
              <p className="mt-1 text-[11px] text-slate-500">rounded-{name}</p>
              <p className="text-[10px] text-slate-400">{value}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="เงา" hint="ชั้นบาง ๆ ซ้อนกันแทนเงาหนาชั้นเดียว — card / cardHover เป็นของเดิม ไม่ได้แก้">
        <div className="flex flex-wrap gap-4 rounded-l bg-sand-50 p-6">
          {Object.entries(theme.boxShadow ?? {}).map(([name, value]) => (
            <div key={name} className="text-center">
              <div className="h-16 w-24 rounded-m bg-white" style={{ boxShadow: value }} />
              <p className="mt-2 text-[11px] text-slate-500">shadow-{name}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="ระยะห่าง" hint="ใช้กับ p- m- gap- w- h- ได้ทั้งหมด">
        <div className="flex flex-col gap-1.5">
          {Object.entries(theme.spacing ?? {}).map(([name, value]) => (
            <div key={name} className="flex items-center gap-3">
              <code className="w-16 shrink-0 text-[11px] text-slate-400">{name}</code>
              <div className="h-3 rounded-xs bg-brand-400" style={{ width: value }} />
              <span className="text-[10px] text-slate-400">{value}</span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
