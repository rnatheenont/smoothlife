"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@heroui/react";
import {
  PageHeader,
  Panel,
  adminCards,
  adminTable,
} from "@/components/admin/layout-kit";
import AdminSelect from "@/components/admin/AdminSelect";
import AdminSearch from "@/components/admin/AdminSearch";

// What the desk did, in the order it happened.
//
// Everything here was already being written on every approval, draw, merge and
// settings change — it simply had no window. The page is read when something
// looks wrong and somebody needs to know what was done to it and when: no
// editing, no deleting, nothing to press.

type Entry = {
  id: string;
  action: string;
  who: string | null;
  actor: string | null;
  target: string | null;
  detail: Record<string, unknown> | null;
  at: string;
};

/** Thai for the actions worth reading as a sentence; the rest show as they are. */
const LABEL: Record<string, string> = {
  "receipt.approve": "อนุมัติใบเสร็จ",
  "receipt.reject": "ตีกลับใบเสร็จ",
  "receipt.reopen": "ดึงกลับมาตรวจใหม่",
  "receipt.recalculate": "คำนวณสิทธิ์ใหม่",
  "receipt.delete": "ลบใบเสร็จ",
  "receipt.settings": "แก้เงื่อนไขกิจกรรม",
  "receipt.campaign.create": "สร้างกิจกรรม",
  "receipt.campaign.delete": "ลบกิจกรรม",
  "receipt.revoke.sweep": "ยกเลิกสิทธิ์ (คืนเงิน)",
  "account.merge": "รวมบัญชีลูกค้า",
  "account.relink-shopify": "ผูกบัญชี Shopify ใหม่",
  "account.delete-test-accounts": "ลบบัญชีทดสอบ",
  "points.purge-test-data": "ล้างข้อมูลแต้มทดสอบ",
  "tracking.attach": "ผูกเลขพัสดุ",
  "tracking.ignore": "ข้ามรายการพัสดุ",
  "tracking.skip": "ข้ามรายการพัสดุ",
  "admin-user.delete": "ลบบัญชีแอดมิน",
  "admin-user.email": "เปลี่ยนอีเมลแอดมิน",
};

const when = (iso: string) =>
  new Date(iso).toLocaleString("th-TH", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function AuditPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [action, setAction] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (action) params.set("action", action);
      const res = await fetch(
        `/api/admin/audit${params.size ? `?${params}` : ""}`,
        { cache: "no-store" },
      );
      const json = await res.json();
      if (!res.ok || !json.ok)
        throw new Error(json.error || "โหลดบันทึกไม่สำเร็จ");
      setEntries(json.entries as Entry[]);
      setActions(json.actions as string[]);
      setTotal(json.total as number);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดบันทึกไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [query, action]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- first load
    load();
  }, [load]);

  return (
    <>
      <PageHeader
        title="บันทึกการใช้งาน"
        subtitle="ทุกการกระทำของทีมแอดมินที่ระบบบันทึกไว้ — อ่านอย่างเดียว แก้ไขหรือลบไม่ได้"
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <AdminSearch
          className="min-w-[220px] flex-1"
          value={search}
          onChange={setSearch}
          placeholder="ค้นหาชื่อแอดมิน รหัสรายการ หรือรายละเอียด"
        />

        <AdminSelect
          label="กรองตามการกระทำ"
          value={action}
          onChange={setAction}
          options={[
            { value: "", label: "ทุกการกระทำ" },
            ...actions.map((a) => ({ value: a, label: LABEL[a] ?? a })),
          ]}
        />

        <Button variant="outline" isPending={loading} onPress={load}>
          <RefreshCw size={14} /> รีเฟรช
        </Button>

        <span className="text-[12px] text-slate-500">
          {total} รายการ
          {total > entries.length ? ` · แสดง ${entries.length} ล่าสุด` : ""}
        </span>
      </div>

      {error && (
        <p className="mb-3 rounded-l border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-800">
          {error}
        </p>
      )}

      <Panel title="ล่าสุดก่อน">
        {entries.length === 0 ? (
          <p className="px-3 py-6 text-[13px] text-slate-500">
            {query || action ? "ไม่พบบันทึกที่ตรงกับที่ค้น" : "ยังไม่มีบันทึก"}
          </p>
        ) : (
          <>
            <ul className={`mt-3 ${adminCards.list}`}>
              {entries.map((e) => (
                <li key={e.id} className={adminCards.item}>
                  <div className={adminCards.head}>
                    <span className="text-[13px] font-bold text-brand-ink">
                      {LABEL[e.action] ?? e.action}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {when(e.at)}
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] text-slate-500">
                    โดย {e.who ?? e.actor ?? "—"}
                    {e.target && <> · รหัส {e.target.slice(0, 8)}</>}
                  </p>
                  {e.detail && Object.keys(e.detail).length > 0 && (
                    <pre className="mt-1.5 overflow-x-auto whitespace-pre-wrap break-all text-[11px] leading-5 text-slate-500">
                      {JSON.stringify(e.detail)}
                    </pre>
                  )}
                </li>
              ))}
            </ul>

            <div className={`mt-3 ${adminCards.forTable} ${adminTable.scroll}`}>
              <table className={adminTable.table}>
                <thead className={adminTable.thead}>
                  <tr>
                    <th>เมื่อไหร่</th>
                    <th>การกระทำ</th>
                    <th>โดย</th>
                    <th>เป้าหมาย</th>
                    <th>รายละเอียด</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id} className={adminTable.row}>
                      <td className={adminTable.muted}>{when(e.at)}</td>
                      <td className={adminTable.cell}>
                        <span className="font-semibold text-brand-ink">
                          {LABEL[e.action] ?? e.action}
                        </span>
                        {LABEL[e.action] && (
                          <span className="block font-mono text-[11px] text-slate-400">
                            {e.action}
                          </span>
                        )}
                      </td>
                      <td className={adminTable.cell}>
                        {e.who ?? e.actor ?? "—"}
                      </td>
                      <td className={adminTable.mono}>
                        {e.target ? e.target.slice(0, 8) : "—"}
                      </td>
                      <td className="px-3 py-2 text-[11px] leading-5 text-slate-500">
                        <span className="block max-w-[420px] break-all">
                          {e.detail && Object.keys(e.detail).length > 0
                            ? JSON.stringify(e.detail)
                            : "—"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Panel>
    </>
  );
}
