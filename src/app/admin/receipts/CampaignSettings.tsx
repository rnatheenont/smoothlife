"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Panel } from "@/components/admin/layout-kit";

// The campaign's own words, edited here instead of in a source file.
//
// The dates are not decoration: the window below is what the eligibility
// filter uses, so moving it changes which orders count. That is said on the
// screen rather than left to be discovered.

type Step = { title: string; body: string };
type Rules = {
  generalThreshold: number;
  keychainPrice: number;
  keychainEntries: number;
  tiered: boolean;
  stacks: boolean;
  rounding: "floor" | "round" | "ceil";
  keychainSlugs: string[];
};
type Content = {
  eyebrow: string;
  title: string;
  intro: string;
  opensAt: number;
  closesAt: number;
  announceAt: number;
  confirmDeadline: number;
  steps: Step[];
  terms: string[];
  rules: Rules;
};

/**
 * The same arithmetic the server does, so the screen that edits it can show
 * what it will do before it does it.
 *
 * Kept deliberately small and in sight: the point is that a threshold typed
 * with a missing zero is visible as "฿690 earns 10 entries" while it can still
 * be corrected, rather than as a prize draw nobody can explain.
 */
function previewEntries(amount: number, rules: Rules, keychain = false): number {
  const round = rules.rounding === "ceil" ? Math.ceil : rules.rounding === "round" ? Math.round : Math.floor;
  const step = keychain ? rules.keychainPrice : rules.generalThreshold;
  const worth = keychain ? rules.keychainEntries : 1;
  if (!(step > 0)) return 0;
  return Math.max(0, rules.tiered ? round(amount / step) * worth : amount >= step ? worth : 0);
}

/** <input type="datetime-local"> wants wall-clock time, and the shop's is Bangkok. */
function toLocalInput(ms: number): string {
  const d = new Date(ms + 7 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 16);
}
function fromLocalInput(v: string): string {
  return v ? `${v}:00+07:00` : "";
}

const field =
  "w-full rounded-lg border border-surface-line px-3 py-2 text-[14px] text-brand-ink focus:border-brand-800 focus:outline-none";

export default function CampaignSettings() {
  const [content, setContent] = useState<Content | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [saving, setSaving] = useState(false);
  const [catalogue, setCatalogue] = useState<{ slug: string; name: string }[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/receipts/settings", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.ok) return setState("error");
      setContent(json.content as Content);
      setCatalogue((json.catalogue ?? []) as { slug: string; name: string }[]);
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- first load
    load();
  }, [load]);

  if (state === "loading") {
    return (
      <Panel title="เงื่อนไขและข้อความบนหน้าแคมเปญ">
        <p className="flex items-center gap-2 px-3 py-6 text-[13px] text-slate-500">
          <Loader2 size={15} className="animate-spin" /> กำลังโหลด
        </p>
      </Panel>
    );
  }
  if (state === "error" || !content) {
    return (
      <Panel title="เงื่อนไขและข้อความบนหน้าแคมเปญ">
        <p className="px-3 py-6 text-[13px] text-rose-700">โหลดข้อมูลไม่สำเร็จ</p>
      </Panel>
    );
  }

  const set = <K extends keyof Content>(key: K, value: Content[K]) => setContent({ ...content, [key]: value });

  async function save() {
    if (!content) return;
    setSaving(true);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/receipts/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eyebrow: content.eyebrow,
          title: content.title,
          intro: content.intro,
          opensAt: fromLocalInput(toLocalInput(content.opensAt)),
          closesAt: fromLocalInput(toLocalInput(content.closesAt)),
          announceAt: fromLocalInput(toLocalInput(content.announceAt)),
          confirmDeadline: fromLocalInput(toLocalInput(content.confirmDeadline)),
          steps: content.steps,
          terms: content.terms.filter((t) => t.trim()),
          rules: content.rules,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || "บันทึกไม่สำเร็จ");
      setContent(json.content as Content);
      setNotice("บันทึกแล้ว — หน้าแคมเปญอัปเดตทันที");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Panel title="ข้อความบนหน้าแคมเปญ" padded>
        <div className="flex flex-col gap-3">
          <label className="block">
            <span className="text-[12px] font-semibold text-slate-500">ชื่อแคมเปญ (ตัวเล็กด้านบน)</span>
            <input className={`mt-1 ${field}`} value={content.eyebrow} onChange={(e) => set("eyebrow", e.target.value)} />
          </label>
          <label className="block">
            <span className="text-[12px] font-semibold text-slate-500">หัวเรื่อง</span>
            <input className={`mt-1 ${field}`} value={content.title} onChange={(e) => set("title", e.target.value)} />
          </label>
          <label className="block">
            <span className="text-[12px] font-semibold text-slate-500">คำอธิบายใต้หัวเรื่อง</span>
            <textarea rows={3} className={`mt-1 ${field}`} value={content.intro} onChange={(e) => set("intro", e.target.value)} />
          </label>
        </div>
      </Panel>

      <Panel title="กำหนดการ" padded>
        {/* Not a caption: these dates decide which orders the form accepts. */}
        <p className="mb-3 rounded-l border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
          ช่วงเปิด–ปิดรับใบเสร็จนี้คือช่วงที่ระบบใช้ตัดสินว่าคำสั่งซื้อใดเข้าเงื่อนไข ไม่ใช่แค่ข้อความบนหน้าเว็บ —
          ถ้าเลื่อนวันเปิดให้เร็วขึ้น คำสั่งซื้อที่ซื้อก่อนหน้าจะเข้าร่วมได้ทันที
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ["opensAt", "เปิดรับใบเสร็จ"],
              ["closesAt", "ปิดรับใบเสร็จ"],
              ["announceAt", "ประกาศผล"],
              ["confirmDeadline", "หมดเขตยืนยันสิทธิ์"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="block">
              <span className="text-[12px] font-semibold text-slate-500">{label}</span>
              <input
                type="datetime-local"
                className={`mt-1 ${field}`}
                value={toLocalInput(content[key])}
                onChange={(e) => {
                  const t = Date.parse(fromLocalInput(e.target.value));
                  if (Number.isFinite(t)) set(key, t);
                }}
              />
            </label>
          ))}
        </div>
      </Panel>

      <Panel title="ขั้นตอนการร่วมกิจกรรม" padded>
        <div className="flex flex-col gap-3">
          {content.steps.map((step, i) => (
            <div key={i} className="rounded-lg border border-surface-line p-3">
              <p className="text-[12px] font-semibold text-slate-500">ขั้นที่ {i + 1}</p>
              <input
                className={`mt-1.5 ${field}`}
                value={step.title}
                placeholder="หัวข้อ"
                onChange={(e) => {
                  const next = [...content.steps];
                  next[i] = { ...step, title: e.target.value };
                  set("steps", next);
                }}
              />
              <textarea
                rows={2}
                className={`mt-2 ${field}`}
                value={step.body}
                placeholder="คำอธิบาย"
                onChange={(e) => {
                  const next = [...content.steps];
                  next[i] = { ...step, body: e.target.value };
                  set("steps", next);
                }}
              />
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="วิธีคำนวณสิทธิ์" padded>
        <p className="mb-3 rounded-l border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-900">
          ตัวเลขในหน้านี้ตัดสินว่าใครได้รางวัล — แก้แล้วมีผลกับใบเสร็จที่ส่งเข้ามา<b>หลังจากนี้</b>ทันที
          ส่วนใบที่อยู่ในคิวแล้วยังถือเลขเดิม ต้องกด <b>คำนวณสิทธิ์ใหม่</b> ในหน้าคิวตรวจ · ทุกการแก้ไขถูกบันทึกใน audit log
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-[12px] font-semibold text-slate-500">ยอดซื้อต่อ 1 สิทธิ์ (บาท)</span>
            <input
              className={`mt-1 ${field}`}
              inputMode="decimal"
              value={content.rules.generalThreshold}
              onChange={(e) => set("rules", { ...content.rules, generalThreshold: Number(e.target.value) || 0 })}
            />
          </label>
          <label className="block">
            <span className="text-[12px] font-semibold text-slate-500">วิธีนับ</span>
            <select
              className={`mt-1 ${field}`}
              value={content.rules.tiered ? "tiered" : "flat"}
              onChange={(e) => set("rules", { ...content.rules, tiered: e.target.value === "tiered" })}
            >
              <option value="tiered">ทุกๆ N บาท ได้ 1 สิทธิ์ (คูณ)</option>
              <option value="flat">ครบ N บาท ได้ 1 สิทธิ์ (ครั้งเดียว)</option>
            </select>
          </label>
          <label className="block">
            <span className="text-[12px] font-semibold text-slate-500">ราคา Set Keychain (บาท)</span>
            <input
              className={`mt-1 ${field}`}
              inputMode="decimal"
              value={content.rules.keychainPrice}
              onChange={(e) => set("rules", { ...content.rules, keychainPrice: Number(e.target.value) || 0 })}
            />
          </label>
          <label className="block">
            <span className="text-[12px] font-semibold text-slate-500">Set Keychain ได้กี่สิทธิ์</span>
            <input
              className={`mt-1 ${field}`}
              inputMode="numeric"
              value={content.rules.keychainEntries}
              onChange={(e) => set("rules", { ...content.rules, keychainEntries: Number(e.target.value) || 0 })}
            />
          </label>
          <label className="block">
            <span className="text-[12px] font-semibold text-slate-500">การปัดเศษ</span>
            <select
              className={`mt-1 ${field}`}
              disabled={!content.rules.tiered}
              value={content.rules.rounding}
              onChange={(e) => set("rules", { ...content.rules, rounding: e.target.value as Rules["rounding"] })}
            >
              <option value="floor">ปัดลง — ฿1,379 = 1 สิทธิ์</option>
              <option value="round">ปัดใกล้สุด — ฿1,379 = 2 สิทธิ์</option>
              <option value="ceil">ปัดขึ้น — ฿691 = 2 สิทธิ์</option>
            </select>
            {!content.rules.tiered && (
              // A threshold rounded up is a different rule, not a rounded one.
              <span className="mt-1 block text-[11px] text-slate-400">
                ใช้ได้เฉพาะวิธีนับแบบ &ldquo;ทุกๆ N บาท&rdquo; — แบบ &ldquo;ครบ N บาท&rdquo; ไม่มีเศษให้ปัด
              </span>
            )}
          </label>
          <label className="block">
            <span className="text-[12px] font-semibold text-slate-500">ซื้อ Keychain พร้อมของอื่น</span>
            <select
              className={`mt-1 ${field}`}
              value={content.rules.stacks ? "stack" : "max"}
              onChange={(e) => set("rules", { ...content.rules, stacks: e.target.value === "stack" })}
            >
              <option value="stack">รวมสิทธิ์ทั้งสองส่วน</option>
              <option value="max">เอาเฉพาะส่วนที่ได้มากกว่า</option>
            </select>
          </label>
        </div>

        {/* What the numbers above actually do, before they do it. */}
        <div className="mt-4 overflow-hidden rounded-l border border-surface-line">
          <p className="bg-surface-soft px-3 py-1.5 text-[12px] font-semibold text-slate-500">
            ลองคำนวณด้วยกฎปัจจุบัน
          </p>
          <ul className="divide-y divide-surface-line text-[12px]">
            {[
              content.rules.generalThreshold - 1,
              content.rules.generalThreshold,
              content.rules.generalThreshold * 2 - 1,
              content.rules.generalThreshold * 2,
              content.rules.generalThreshold * 3,
            ].map((amount, i) => (
              <li key={i} className="flex items-baseline justify-between px-3 py-1.5">
                <span className="text-slate-600">ยอด DENTISTE&apos; ฿{amount.toLocaleString()}</span>
                <span className="font-bold text-brand-ink">{previewEntries(amount, content.rules)} สิทธิ์</span>
              </li>
            ))}
            <li className="flex items-baseline justify-between px-3 py-1.5">
              <span className="text-slate-600">Set Keychain ฿{content.rules.keychainPrice.toLocaleString()}</span>
              <span className="font-bold text-brand-ink">
                {previewEntries(content.rules.keychainPrice, content.rules, true)} สิทธิ์
              </span>
            </li>
          </ul>
          {/* Rounding up or to nearest hands an entry to somebody who did not
              reach the threshold — with "ปัดขึ้น", ฿1 does it. Legitimate if
              it is what was meant, and worth saying out loud either way. */}
          {content.rules.tiered && previewEntries(content.rules.generalThreshold - 1, content.rules) > 0 && (
            <p className="border-t border-surface-line bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
              การปัดแบบนี้ทำให้ยอดที่<b>ยังไม่ถึง ฿{content.rules.generalThreshold.toLocaleString()}</b> ได้สิทธิ์ไปด้วย
              {content.rules.rounding === "ceil" && <> — แบบปัดขึ้น ยอดเพียง ฿1 ก็ได้ 1 สิทธิ์</>}
            </p>
          )}
        </div>

        <div className="mt-4">
          <p className="text-[12px] font-semibold text-slate-500">สินค้าที่นับเป็น Set Keychain</p>
          <p className="mt-1 text-[11px] text-slate-400">
            ถ้าไม่เลือกอะไรเลย ทุกชิ้นจะถูกคิดเป็นยอดซื้อปกติ — Keychain จะไม่ได้ {content.rules.keychainEntries} สิทธิ์
          </p>
          <div className="mt-2 max-h-52 overflow-y-auto rounded-l border border-surface-line">
            {catalogue.length === 0 ? (
              <p className="px-3 py-3 text-[12px] text-slate-400">ไม่พบสินค้าแบรนด์ DENTISTE&apos; ในแคตตาล็อก</p>
            ) : (
              <ul className="divide-y divide-surface-line">
                {catalogue.map((product) => (
                  <li key={product.slug}>
                    <label className="flex cursor-pointer items-start gap-2 px-3 py-2 text-[12px] hover:bg-surface-soft">
                      <input
                        type="checkbox"
                        className="mt-0.5 size-3.5 shrink-0 rounded"
                        checked={content.rules.keychainSlugs.includes(product.slug)}
                        onChange={(e) =>
                          set("rules", {
                            ...content.rules,
                            keychainSlugs: e.target.checked
                              ? [...content.rules.keychainSlugs, product.slug]
                              : content.rules.keychainSlugs.filter((slug) => slug !== product.slug),
                          })
                        }
                      />
                      <span className="text-brand-ink">{product.name}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Panel>

      <Panel title="เงื่อนไขการร่วมกิจกรรม" padded>
        <p className="mb-3 text-[12px] text-slate-500">
          แสดงเป็นข้อ ๆ ท้ายหน้าแคมเปญ — ให้ตรงกับเอกสารที่ประกาศออกไป
        </p>
        <div className="flex flex-col gap-2">
          {content.terms.map((term, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="mt-2.5 w-5 shrink-0 text-right text-[12px] tabular-nums text-slate-400">{i + 1}.</span>
              <textarea
                rows={2}
                className={field}
                value={term}
                onChange={(e) => {
                  const next = [...content.terms];
                  next[i] = e.target.value;
                  set("terms", next);
                }}
              />
              <button
                type="button"
                aria-label={`ลบข้อ ${i + 1}`}
                onClick={() => set("terms", content.terms.filter((_, j) => j !== i))}
                className="mt-1.5 grid size-8 shrink-0 place-items-center rounded-full text-slate-400 hover:bg-surface-soft hover:text-rose-600"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => set("terms", [...content.terms, ""])}
          className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-full border border-surface-line px-4 text-[13px] font-semibold text-brand-800 hover:bg-surface-soft"
        >
          <Plus size={15} /> เพิ่มเงื่อนไข
        </button>
      </Panel>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={save}
          className="inline-flex min-h-10 items-center gap-2 rounded-full bg-brand-800 px-6 text-[14px] font-semibold text-white disabled:opacity-50"
        >
          {saving && <Loader2 size={15} className="animate-spin" />}
          {saving ? "กำลังบันทึก…" : "บันทึกเงื่อนไข"}
        </button>
        {notice && <span className="text-[13px] text-slate-600">{notice}</span>}
      </div>
    </div>
  );
}
