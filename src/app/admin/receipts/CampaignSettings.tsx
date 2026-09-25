"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Loader2, Plus, Trash2 } from "lucide-react";
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

/** Sits inside a sentence rather than under a label. */
const inlineField =
  "rounded-lg border border-surface-line px-2 py-1 text-[14px] text-brand-ink focus:border-brand-800 focus:outline-none";

export default function CampaignSettings({ campaignQuery = "" }: { campaignQuery?: string }) {
  const [content, setContent] = useState<Content | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [saving, setSaving] = useState(false);
  const [catalogue, setCatalogue] = useState<{ slug: string; name: string }[]>([]);
  const [pickingKeychain, setPickingKeychain] = useState(false);
  const [keychainSearch, setKeychainSearch] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/receipts/settings${campaignQuery}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.ok) return setState("error");
      setContent(json.content as Content);
      setCatalogue((json.catalogue ?? []) as { slug: string; name: string }[]);
      setState("ready");
    } catch {
      setState("error");
    }
  }, [campaignQuery]);

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
      const res = await fetch(`/api/admin/receipts/settings${campaignQuery}`, {
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
        <p className="mb-4 flex items-start gap-2 rounded-l border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] leading-relaxed text-amber-900">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>
            ตัวเลขในหน้านี้ตัดสินว่าใครได้รางวัล — มีผลกับใบเสร็จที่ส่งเข้ามา<b>หลังจากนี้</b>ทันที
            ใบที่อยู่ในคิวแล้วต้องกด <b>คำนวณสิทธิ์ใหม่</b> · ทุกการแก้ไขถูกบันทึกใน audit log
          </span>
        </p>

        {/* Written as the rules read, not as six fields in a grid. The point
            of the sentence is that the relationship between the boxes is the
            rule — a threshold, a way of counting and a rounding mode are one
            statement, and laid out as separate labelled inputs they stop
            looking like one. */}
        <div className="flex flex-col gap-3">
          <div className="rounded-l border border-surface-line p-3">
            <p className="text-[12px] font-bold uppercase tracking-wide text-slate-400">
              กฎที่ 1 · ยอดซื้อ DENTISTE&apos;
            </p>
            <p className="mt-2 flex flex-wrap items-center gap-2 text-[14px] text-brand-ink">
              <select
                className={`${inlineField} w-auto`}
                value={content.rules.tiered ? "tiered" : "flat"}
                onChange={(e) => set("rules", { ...content.rules, tiered: e.target.value === "tiered" })}
              >
                <option value="tiered">ทุกๆ</option>
                <option value="flat">ครบ</option>
              </select>
              <input
                className={`${inlineField} w-24 text-center tabular-nums`}
                inputMode="decimal"
                value={content.rules.generalThreshold}
                onChange={(e) => set("rules", { ...content.rules, generalThreshold: Number(e.target.value) || 0 })}
              />
              <span>บาทต่อใบเสร็จ =</span>
              <b className="text-[15px]">1 สิทธิ์</b>
              {content.rules.tiered && (
                <>
                  <span className="text-slate-400">·</span>
                  <span className="text-slate-500">เศษที่เหลือ</span>
                  <select
                    className={`${inlineField} w-auto`}
                    value={content.rules.rounding}
                    onChange={(e) => set("rules", { ...content.rules, rounding: e.target.value as Rules["rounding"] })}
                  >
                    <option value="floor">ปัดลง</option>
                    <option value="round">ปัดใกล้สุด</option>
                    <option value="ceil">ปัดขึ้น</option>
                  </select>
                </>
              )}
            </p>

            {/* The rule's own behaviour, on the line under it. */}
            <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[12px] tabular-nums text-slate-500">
              {[
                content.rules.generalThreshold - 1,
                content.rules.generalThreshold,
                content.rules.generalThreshold * 2 - 1,
                content.rules.generalThreshold * 2,
                content.rules.generalThreshold * 3,
              ].map((amount, i) => (
                <li key={i}>
                  ฿{amount.toLocaleString()} →{" "}
                  <b className="text-brand-ink">{previewEntries(amount, content.rules)}</b>
                </li>
              ))}
            </ul>
            {content.rules.tiered && previewEntries(content.rules.generalThreshold - 1, content.rules) > 0 && (
              <p className="mt-2 text-[12px] text-amber-800">
                ⚠ ยอดที่ยังไม่ถึง ฿{content.rules.generalThreshold.toLocaleString()} ก็ได้สิทธิ์ด้วย
                {content.rules.rounding === "ceil" && <> — แบบปัดขึ้น ยอดเพียง ฿1 ก็ได้ 1 สิทธิ์</>}
              </p>
            )}
          </div>

          <div className="rounded-l border border-surface-line p-3">
            <p className="text-[12px] font-bold uppercase tracking-wide text-slate-400">กฎที่ 2 · Set Keychain</p>
            <p className="mt-2 flex flex-wrap items-center gap-2 text-[14px] text-brand-ink">
              <span>{content.rules.tiered ? "ทุกๆ" : "ครบ"}</span>
              <input
                className={`${inlineField} w-24 text-center tabular-nums`}
                inputMode="decimal"
                value={content.rules.keychainPrice}
                onChange={(e) => set("rules", { ...content.rules, keychainPrice: Number(e.target.value) || 0 })}
              />
              <span>บาทต่อใบเสร็จ =</span>
              <input
                className={`${inlineField} w-16 text-center tabular-nums`}
                inputMode="numeric"
                value={content.rules.keychainEntries}
                onChange={(e) => set("rules", { ...content.rules, keychainEntries: Number(e.target.value) || 0 })}
              />
              <b className="text-[15px]">สิทธิ์</b>
            </p>

            {/* The rule cannot fire at all until somebody says which products
                it is about, so that is said here rather than in small print. */}
            {content.rules.keychainSlugs.length === 0 ? (
              <p className="mt-2.5 rounded bg-rose-50 px-2.5 py-1.5 text-[12px] text-rose-800">
                ⚠ ยังไม่ได้เลือกสินค้า — กฎนี้จะไม่ทำงาน ทุกชิ้นถูกคิดเป็นยอดซื้อปกติตามกฎที่ 1
              </p>
            ) : (
              <p className="mt-2.5 text-[12px] text-slate-500">
                เลือกไว้ {content.rules.keychainSlugs.length} รายการ · ฿
                {content.rules.keychainPrice.toLocaleString()} →{" "}
                <b className="text-brand-ink">{previewEntries(content.rules.keychainPrice, content.rules, true)}</b> สิทธิ์
              </p>
            )}

            <button
              type="button"
              onClick={() => setPickingKeychain((v) => !v)}
              className="mt-2 text-[12px] font-semibold text-brand-800 underline"
            >
              {pickingKeychain ? "ปิดรายการสินค้า" : "เลือกสินค้าที่นับเป็น Set Keychain"}
            </button>

            {pickingKeychain && (
              <div className="mt-2">
                <input
                  className={field}
                  placeholder="ค้นหาชื่อสินค้า…"
                  value={keychainSearch}
                  onChange={(e) => setKeychainSearch(e.target.value)}
                />
                <div className="mt-2 max-h-56 overflow-y-auto rounded-l border border-surface-line">
                  {(() => {
                    const q = keychainSearch.trim().toLowerCase();
                    const shown = q ? catalogue.filter((c) => c.name.toLowerCase().includes(q)) : catalogue;
                    if (!shown.length) {
                      return <p className="px-3 py-3 text-[12px] text-slate-400">ไม่พบสินค้าที่ค้นหา</p>;
                    }
                    return (
                      <ul className="divide-y divide-surface-line">
                        {shown.map((product) => (
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
                    );
                  })()}
                </div>
              </div>
            )}
          </div>

          <p className="flex flex-wrap items-center gap-2 px-1 text-[13px] text-slate-600">
            <span>ถ้าบิลเดียวเข้าทั้งสองกฎ</span>
            <select
              className={`${inlineField} w-auto`}
              value={content.rules.stacks ? "stack" : "max"}
              onChange={(e) => set("rules", { ...content.rules, stacks: e.target.value === "stack" })}
            >
              <option value="stack">รวมสิทธิ์ทั้งสองส่วน</option>
              <option value="max">เอาเฉพาะส่วนที่ได้มากกว่า</option>
            </select>
          </p>
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
