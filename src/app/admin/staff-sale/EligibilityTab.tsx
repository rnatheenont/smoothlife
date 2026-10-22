"use client";

import { useCallback, useEffect, useState } from "react";
import { Ban, Globe, Mail, Plus } from "lucide-react";
import { Button } from "@heroui/react";
import { Badge } from "@/components/ui";
import AdminField from "@/components/admin/AdminField";
import { Panel, adminTable } from "@/components/admin/layout-kit";
import { canonStaffDomain, canonStaffEmail, type EligibilityKind } from "@/lib/staff-sale";
import type { EligibilityRule } from "./types";

// Who may buy: the allowed domains, the individual exceptions, and the
// blocklist — one list, because an admin looking at this page is asking one
// question and the answer is the three of them together.
//
// The rules are not per round. A round opening does not re-ask who works
// here, and an exception granted in October should not have to be granted
// again in November.

const KIND_LABEL: Record<EligibilityKind, string> = {
  allow_domain: "โดเมนที่อนุญาต",
  allow_email: "อีเมลที่อนุญาตเพิ่ม",
  block_email: "ระงับสิทธิ์",
};

const KIND_ICON: Record<EligibilityKind, typeof Globe> = {
  allow_domain: Globe,
  allow_email: Mail,
  block_email: Ban,
};

const DEFAULT_DOMAIN = "smooth-e.com";

function thaiDate(iso: string): string {
  return new Date(iso).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });
}

export default function EligibilityTab({
  busy,
  onError,
  onNote,
}: {
  busy: boolean;
  onError: (msg: string | null) => void;
  onNote: (msg: string | null) => void;
}) {
  const [rules, setRules] = useState<EligibilityRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState<EligibilityKind>("allow_email");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [expires, setExpires] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/staff-sale/eligibility", { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "โหลดสิทธิ์ไม่สำเร็จ");
      setRules(json.rules);
    } catch (err) {
      onError(err instanceof Error ? err.message : "โหลดสิทธิ์ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const live = rules.filter((r) => !r.revoked_at);
  const revoked = rules.filter((r) => r.revoked_at);
  const hasDefaultDomain = live.some(
    (r) => r.kind === "allow_domain" && r.value === DEFAULT_DOMAIN,
  );

  // What the row will actually be saved as, shown before saving it. An
  // exception stored with a +tag or a capital letter would never match.
  const canon = value
    ? kind === "allow_domain"
      ? canonStaffDomain(value)
      : canonStaffEmail(value)
    : null;

  async function add(payload: { kind: EligibilityKind; value: string; reason?: string; expires_at?: string }) {
    setSaving(true);
    onError(null);
    onNote(null);
    try {
      const res = await fetch("/api/admin/staff-sale/eligibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "เพิ่มไม่สำเร็จ");
      setValue("");
      setReason("");
      setExpires("");
      await load();
    } catch (err) {
      onError(err instanceof Error ? err.message : "เพิ่มไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function revoke(rule: EligibilityRule) {
    if (!confirm(`ยกเลิก "${rule.value}" ออกจาก${KIND_LABEL[rule.kind]}?`)) return;
    onError(null);
    const res = await fetch("/api/admin/staff-sale/eligibility", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: rule.id }),
    });
    const json = await res.json();
    if (!json.ok) {
      onError(json.error ?? "ยกเลิกไม่สำเร็จ");
      return;
    }
    if (json.note) onNote(json.note);
    await load();
  }

  return (
    <div className="space-y-4">
      {!loading && !hasDefaultDomain && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl2 bg-amber-50 p-3 text-[13px] text-amber-800">
          <p className="flex-1">
            ยังไม่มีโดเมนที่อนุญาต — ตอนนี้พนักงานยืนยันอีเมลไม่ได้เลย นอกจากคนที่เพิ่มเป็นรายบุคคล
          </p>
          <Button
            size="sm"
            onPress={() => add({ kind: "allow_domain", value: DEFAULT_DOMAIN })}
            isDisabled={saving}
          >
            อนุญาต @{DEFAULT_DOMAIN}
          </Button>
        </div>
      )}

      <Panel title="เพิ่มสิทธิ์" padded>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-[12px] font-medium text-slate-500">
            ประเภท
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as EligibilityKind)}
              className="h-10 rounded-xl2 border border-slate-200 bg-white px-3 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-800"
            >
              <option value="allow_email">อีเมลที่อนุญาตเพิ่ม</option>
              <option value="allow_domain">โดเมนที่อนุญาต</option>
              <option value="block_email">ระงับสิทธิ์ (ห้ามซื้อ)</option>
            </select>
          </label>
          <AdminField
            label={kind === "allow_domain" ? "โดเมน" : "อีเมล"}
            value={value}
            onChange={setValue}
            placeholder={kind === "allow_domain" ? "smooth-e.com" : "somchai@smooth-e.com"}
            hint={
              canon && canon !== value.trim().toLowerCase()
                ? `จะบันทึกเป็น ${canon}`
                : kind === "allow_domain"
                  ? "เทียบแบบตรงตัว ไม่รวมโดเมนย่อย"
                  : "ตัด +ข้อความ และตัวพิมพ์เล็ก-ใหญ่ออกก่อนบันทึก"
            }
            isRequired
          />
          {kind !== "allow_domain" && (
            <>
              <AdminField
                label="เหตุผล"
                value={reason}
                onChange={setReason}
                placeholder={kind === "block_email" ? "เช่น ลาออกแล้ว" : "เช่น พนักงานสัญญาจ้าง"}
              />
              <AdminField
                label="หมดอายุ (ไม่ใส่ = ไม่หมดอายุ)"
                type="date"
                value={expires}
                onChange={setExpires}
              />
            </>
          )}
        </div>
        <div className="mt-4">
          <Button
            size="sm"
            onPress={() =>
              add({
                kind,
                value,
                reason: reason || undefined,
                expires_at: expires || undefined,
              })
            }
            isDisabled={saving || busy || !canon}
          >
            <Plus className="h-4 w-4" aria-hidden />
            เพิ่ม
          </Button>
        </div>
        <p className="mt-3 text-[12px] text-slate-500">
          รายชื่อระงับสิทธิ์มีผลเหนือทุกอย่าง และมีผลทันทีกับคนที่ยืนยันอีเมลไปแล้ว — ใช้อันนี้ถ้าต้องหยุดใครกลางรอบ
        </p>
      </Panel>

      <Panel title={`สิทธิ์ที่ใช้อยู่ · ${live.length} รายการ`}>
        <div className={`${adminTable.scroll} max-h-[420px]`}>
          <table className={adminTable.table}>
            <thead className={adminTable.thead}>
              <tr>
                <th>ประเภท</th>
                <th>ค่า</th>
                <th>เหตุผล</th>
                <th>หมดอายุ</th>
                <th>เพิ่มเมื่อ</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td className={adminTable.muted} colSpan={6}>
                    กำลังโหลด…
                  </td>
                </tr>
              )}
              {!loading && live.length === 0 && (
                <tr>
                  <td className={adminTable.muted} colSpan={6}>
                    ยังไม่มีรายการ
                  </td>
                </tr>
              )}
              {live.map((r) => {
                const Icon = KIND_ICON[r.kind];
                const expired = r.expires_at && new Date(r.expires_at) < new Date();
                return (
                  <tr key={r.id} className={adminTable.row}>
                    <td className={adminTable.cell}>
                      <Badge tone={r.kind === "block_email" ? "danger" : "success"}>
                        <Icon className="mr-1 inline h-3 w-3" aria-hidden />
                        {KIND_LABEL[r.kind]}
                      </Badge>
                    </td>
                    <td className={adminTable.cell}>{r.value}</td>
                    <td className={adminTable.muted}>{r.reason ?? "—"}</td>
                    <td className={adminTable.muted}>
                      {r.expires_at ? (
                        <span className={expired ? "text-amber-700" : undefined}>
                          {thaiDate(r.expires_at)}
                          {expired && " · หมดแล้ว"}
                        </span>
                      ) : (
                        "ไม่หมดอายุ"
                      )}
                    </td>
                    <td className={adminTable.muted}>{thaiDate(r.created_at)}</td>
                    <td className={adminTable.cell}>
                      <div className="flex justify-end">
                        <Button size="sm" variant="ghost" onPress={() => revoke(r)}>
                          ยกเลิก
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      {revoked.length > 0 && (
        <Panel title={`ยกเลิกไปแล้ว · ${revoked.length} รายการ`}>
          <div className={`${adminTable.scroll} max-h-[260px]`}>
            <table className={adminTable.table}>
              <thead className={adminTable.thead}>
                <tr>
                  <th>ประเภท</th>
                  <th>ค่า</th>
                  <th>เหตุผล</th>
                  <th>ยกเลิกเมื่อ</th>
                </tr>
              </thead>
              <tbody>
                {revoked.map((r) => (
                  <tr key={r.id} className={adminTable.row}>
                    <td className={adminTable.muted}>{KIND_LABEL[r.kind]}</td>
                    <td className={adminTable.muted}>{r.value}</td>
                    <td className={adminTable.muted}>{r.reason ?? "—"}</td>
                    <td className={adminTable.muted}>{thaiDate(r.revoked_at!)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Kept rather than deleted: who could buy at staff prices, and
              when that stopped, is the question an audit of this page asks. */}
        </Panel>
      )}
    </div>
  );
}
