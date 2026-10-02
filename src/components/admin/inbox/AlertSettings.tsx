"use client";

import clsx from "clsx";
import { useEffect, useState } from "react";
import { Loader2, BellRing, Check, X, Send } from "lucide-react";
import { Button, Input, Label, TextField } from "@heroui/react";

// Where "somebody is waiting" gets sent, edited by the people it gets sent to.
//
// It lives on the inbox rather than in a settings area of its own, because the
// moment anyone wonders where these go is the moment they are looking at a
// case nobody answered.
//
// Reports whether each channel can deliver at all, separately from whether an
// address is filled in: an address saved against a shop with no mail provider
// behind it looks exactly like a working one until the day it matters.

type Settings = { alertEmail: string; lineTo: string; waitingMinutes: number };
type LineGroup = { group_id: string; kind: string; last_seen_at: string };

export default function AlertSettings({ onClose }: { onClose: () => void }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [channels, setChannels] = useState<{ email: boolean; line: boolean }>({ email: false, line: false });
  const [lineGroups, setLineGroups] = useState<LineGroup[]>([]);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/inbox-alert-settings")
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) {
          setError(d.error || "โหลดการตั้งค่าไม่สำเร็จ");
          return;
        }
        setSettings(d.settings);
        setChannels(d.channels);
        setLineGroups(d.lineGroups ?? []);
      })
      .catch(() => setError("โหลดการตั้งค่าไม่สำเร็จ"));
  }, []);

  async function save() {
    if (!settings) return;
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch("/api/admin/inbox-alert-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "บันทึกไม่สำเร็จ");
        return;
      }
      setSettings(data.settings);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  /** Runs the real alerter rather than sending a pretend message, so what
   *  arrives is what would arrive — and if nothing is waiting, it says so
   *  instead of inventing a case to tell you about. */
  async function sendTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const data = await fetch("/api/cron/inbox-alert").then((r) => r.json());
      if (!data.ok) {
        setTestResult(data.error || "ส่งทดสอบไม่สำเร็จ");
        return;
      }
      const sent = [data.emailed ? "อีเมล" : null, data.lined ? "LINE" : null].filter(Boolean);
      const fresh = (data.newlyUrgent?.length ?? 0) + (data.newlyWaiting?.length ?? 0);
      setTestResult(
        fresh === 0
          ? `ตอนนี้ไม่มีเคสที่เข้าเงื่อนไข (ตรวจ ${data.checked ?? 0} เคส) — ยังไม่มีอะไรให้แจ้ง`
          : sent.length > 0
            ? `ส่งแล้ว ${fresh} เคส ทาง ${sent.join(" และ ")}${data.emailError ? ` · อีเมลไม่สำเร็จ: ${data.emailError}` : ""}`
            : `พบ ${fresh} เคส แต่ส่งไม่ได้: ${data.emailError ?? data.skipped ?? "ไม่ทราบสาเหตุ"}`,
      );
    } catch {
      setTestResult("ส่งทดสอบไม่สำเร็จ");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="mb-3 rounded-xl2 border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-ink">
          <BellRing size={15} className="text-brand-emerald" aria-hidden="true" /> ปลายทางแจ้งเตือนเคส
        </p>
        <button
          onClick={onClose}
          aria-label="ปิด"
          className="rounded-md p-1 text-slate-400 hover:bg-surface-soft hover:text-brand-ink"
        >
          <X size={15} />
        </button>
      </div>

      {!settings ? (
        <p className="text-xs text-slate-400">
          {error || (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 size={13} className="animate-spin" /> กำลังโหลด…
            </span>
          )}
        </p>
      ) : (
        <div className="flex flex-col gap-3 text-xs">
          <div className="grid gap-3 md:grid-cols-3">
            <TextField
              type="email"
              value={settings.alertEmail}
              onChange={(v) => setSettings({ ...settings, alertEmail: v })}
              fullWidth
            >
              <Label className="text-xs font-semibold text-slate-600">
                อีเมล
                {!channels.email && (
                  <span className="ml-1.5 font-normal text-amber-600">(ยังไม่ได้ตั้งค่าระบบส่งอีเมล)</span>
                )}
              </Label>
              <Input placeholder="cs@smoothlife.com" />
            </TextField>

            <TextField
              value={settings.lineTo}
              onChange={(v) => setSettings({ ...settings, lineTo: v })}
              fullWidth
            >
              <Label className="text-xs font-semibold text-slate-600">
                LINE id ของกลุ่มทีมงาน
                {!channels.line && (
                  <span className="ml-1.5 font-normal text-amber-600">(ยังไม่ได้ตั้งค่า LINE)</span>
                )}
              </Label>
              <Input className="font-mono" placeholder="Cxxxxxxxx… (กลุ่ม) หรือ Uxxxxxxxx… (คน)" />
              {/* A group id is nowhere in the LINE app — it only ever appears
                  in a webhook payload. These are the groups the OA has been
                  added to, so this field can be filled by pointing rather
                  than by finding a 33-character string that is not shown
                  anywhere. */}
              {lineGroups.length > 0 ? (
                <span className="flex flex-wrap items-center gap-1 pt-0.5">
                  <span className="text-[11px] text-slate-500">กลุ่มที่บอทอยู่:</span>
                  {lineGroups.map((g) => (
                    <button
                      key={g.group_id}
                      type="button"
                      onClick={() => setSettings({ ...settings, lineTo: g.group_id })}
                      className={clsx(
                        "rounded-full px-2 py-0.5 font-mono text-[10px] ring-1 transition-colors",
                        settings.lineTo === g.group_id
                          ? "bg-brand-50 text-brand-800 ring-brand-200"
                          : "bg-white text-slate-600 ring-slate-200 hover:bg-surface-soft",
                      )}
                    >
                      {g.kind === "room" ? "ห้องแชท" : "กลุ่ม"} …{g.group_id.slice(-6)}
                    </button>
                  ))}
                </span>
              ) : (
                <span className="pt-0.5 text-[11px] leading-relaxed text-slate-500">
                  ยังไม่เคยเห็นกลุ่มไหนเลย — เชิญ OA ของร้านเข้ากลุ่มทีมงาน แล้วพิมพ์
                  อะไรก็ได้ในกลุ่มหนึ่งครั้ง จากนั้นกดเปิดหน้านี้ใหม่ กลุ่มจะมาขึ้นให้เลือกตรงนี้
                  (บอทไม่ตอบอะไรในกลุ่ม แค่จำรหัสกลุ่มไว้)
                </span>
              )}
            </TextField>

            <TextField
              type="number"
              value={String(settings.waitingMinutes)}
              onChange={(v) => setSettings({ ...settings, waitingMinutes: Number(v) })}
              fullWidth
            >
              <Label className="text-xs font-semibold text-slate-600">แจ้งเมื่อรอเกิน (นาที)</Label>
              <Input min={1} max={1440} />
            </TextField>
          </div>

          <p className="text-[11px] leading-relaxed text-slate-400">
            เคสที่ขึ้นธงด่วนจะแจ้งทันทีไม่ต้องรอครบเวลา · แจ้งครั้งเดียวต่อเคส
            และจะแจ้งอีกครั้งก็ต่อเมื่อเคสนั้นถูกตอบหรือปิดไปแล้วกลับมารออีก ·
            LINE ต้องเป็นกลุ่มของทีมงาน ไม่ใช่ OA ที่คุยกับลูกค้า
          </p>

          {error && <p className="text-rose-600">{error}</p>}
          {testResult && <p className="text-slate-600">{testResult}</p>}

          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onPress={save} isPending={saving}>
              {saved && !saving ? <Check size={13} /> : null}
              {saved ? "บันทึกแล้ว" : "บันทึก"}
            </Button>
            <Button size="sm" variant="secondary" onPress={sendTest} isPending={testing}>
              {!testing && <Send size={13} />}
              ส่งทดสอบ
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
