"use client";

import { useEffect, useState } from "react";
import { UserCog, Plus, Copy, Check, KeyRound, Ban, RotateCcw } from "lucide-react";
import { Button, Badge, Field, Modal } from "@/components/ui";
import { useAdminAction } from "@/components/admin/header-action";

type Role = { key: string; label: string };
type AdminUserRow = {
  id: string;
  email: string;
  display_name: string;
  role_key: string;
  status: "active" | "suspended";
  created_at: string;
  last_login_at: string | null;
};

const EMPTY_FORM = { email: "", display_name: "", role_key: "" };

function formatDate(iso: string | null) {
  if (!iso) return "ยังไม่เคยเข้าระบบ";
  return new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit", timeZone: "Asia/Bangkok" });
}

// Shown once, right after a create or a reset — the temporary password is
// never retrievable again after this closes, so the owner has to copy it (or
// relay it) now.
function TempPasswordModal({
  open,
  onClose,
  email,
  tempPassword,
}: {
  open: boolean;
  onClose: () => void;
  email: string;
  tempPassword: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <Modal open={open} onClose={onClose} title="รหัสผ่านชั่วคราว" description={`สำหรับ ${email} — เห็นได้แค่ครั้งนี้ครั้งเดียว`}>
      <div className="flex items-center gap-2 rounded-lg border border-dashed border-brand-teal/40 bg-brand-gradient-soft px-3 py-2.5">
        <code className="min-w-0 flex-1 truncate text-sm font-semibold text-brand-ink">{tempPassword}</code>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(tempPassword).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            });
          }}
          className="shrink-0 rounded-full p-1.5 text-brand-800 hover:bg-white/60"
          aria-label="คัดลอก"
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}
        </button>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        ส่งรหัสผ่านนี้ให้เจ้าของบัญชีทางช่องทางที่ปลอดภัย (ไม่ใช่แชทสาธารณะ) แนะนำให้เปลี่ยนรหัสผ่านทันทีหลังเข้าใช้งานครั้งแรก
      </p>
    </Modal>
  );
}

export default function AdminUsersPage() {
  const [me, setMe] = useState<{ id: string; role_key: string } | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [tempPassword, setTempPassword] = useState<{ email: string; value: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    const [meRes, usersRes] = await Promise.all([fetch("/api/admin/me"), fetch("/api/admin/users")]);
    const meData = await meRes.json().catch(() => null);
    setMe(meData?.user ?? null);
    const usersData = await usersRes.json().catch(() => null);
    if (!usersData?.ok) {
      // Not an owner (or a legacy shared-password session, which reads as one
      // and never lands here) — the most common reason is simply "not owner".
      setError(usersData?.error || "โหลดรายชื่อผู้ใช้ไม่สำเร็จ");
      setLoading(false);
      return;
    }
    setUsers(usersData.users);
    setRoles(usersData.roles);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  useAdminAction({
    label: "เพิ่มผู้ใช้ใหม่",
    icon: <Plus size={15} aria-hidden />,
    onClick: () => {
      setForm(EMPTY_FORM);
      setFormError("");
      setCreateOpen(true);
    },
    disabled: loading || Boolean(error),
  });

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!data.ok) {
        setFormError(data.error || "เพิ่มผู้ใช้ไม่สำเร็จ");
        return;
      }
      setCreateOpen(false);
      setTempPassword({ email: data.user.email, value: data.user.tempPassword });
      load();
    } finally {
      setSubmitting(false);
    }
  }

  async function patchUser(id: string, patch: Record<string, unknown>) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!data.ok) {
        window.alert(data.error || "แก้ไขไม่สำเร็จ");
        return;
      }
      if (patch.reset_password) {
        const target = users.find((u) => u.id === id);
        if (target) setTempPassword({ email: target.email, value: data.tempPassword });
        return;
      }
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...data.user } : u)));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="mb-4">
        <h1 className="flex items-center gap-2 text-xl font-bold text-brand-ink">
          <UserCog size={20} className="text-brand-emerald" /> ผู้ใช้ &amp; สิทธิ์
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          จัดการว่าใครเข้าระบบหลังบ้านได้บ้าง และแต่ละคนทำอะไรได้บ้าง — เฉพาะเจ้าของระบบเท่านั้นที่เห็นหน้านี้
        </p>
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">กำลังโหลด…</p>
      ) : error ? (
        <div className="rounded-xl2 border border-dashed border-slate-200 py-10 text-center">
          <p className="text-sm text-slate-500">{error}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {users.map((u) => {
            const isSelf = me?.id === u.id;
            const roleLabel = roles.find((r) => r.key === u.role_key)?.label ?? u.role_key;
            return (
              <div key={u.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-100 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-brand-ink">
                    {u.display_name}
                    {isSelf && <Badge tone="brand">คุณ</Badge>}
                    {u.status === "suspended" && <Badge tone="danger">ระงับการใช้งาน</Badge>}
                  </p>
                  <p className="text-xs text-slate-400">
                    {u.email} · เข้าระบบล่าสุด {formatDate(u.last_login_at)}
                  </p>
                </div>

                <select
                  value={u.role_key}
                  disabled={isSelf || busyId === u.id}
                  onChange={(e) => patchUser(u.id, { role_key: e.target.value })}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-brand-ink outline-hidden focus-visible:ring-2 focus-visible:ring-brand-600 disabled:opacity-50"
                  aria-label={`สิทธิ์ของ ${u.display_name}`}
                >
                  {roles.map((r) => (
                    <option key={r.key} value={r.key}>
                      {r.label}
                    </option>
                  ))}
                </select>
                {isSelf && !roles.some((r) => r.key === u.role_key) && (
                  // Defensive only: today's seed always has every role_key a
                  // user could hold, so this never actually renders.
                  <span className="text-xs text-slate-400">{roleLabel}</span>
                )}

                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busyId === u.id}
                  onClick={() => patchUser(u.id, { reset_password: true })}
                >
                  <KeyRound size={13} /> ตั้งรหัสผ่านใหม่
                </Button>

                <Button
                  variant={u.status === "active" ? "danger" : "secondary"}
                  size="sm"
                  disabled={isSelf || busyId === u.id}
                  onClick={() => patchUser(u.id, { status: u.status === "active" ? "suspended" : "active" })}
                >
                  {u.status === "active" ? (
                    <>
                      <Ban size={13} /> ระงับ
                    </>
                  ) : (
                    <>
                      <RotateCcw size={13} /> เปิดใช้งานอีกครั้ง
                    </>
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="เพิ่มผู้ใช้ใหม่" description="ระบบจะออกรหัสผ่านชั่วคราวให้ทันที">
        <form onSubmit={submitCreate} className="space-y-3">
          <Field
            label="อีเมล"
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="name@smoothlife.com"
          />
          <Field
            label="ชื่อที่ใช้แสดงผล"
            required
            value={form.display_name}
            onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
            placeholder="เช่น น้ำฝน (ทีมแชท)"
          />
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              สิทธิ์ <span className="text-rose-700">*</span>
            </label>
            <select
              required
              value={form.role_key}
              onChange={(e) => setForm((f) => ({ ...f, role_key: e.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-brand-600"
            >
              <option value="" disabled>
                เลือกสิทธิ์
              </option>
              {roles.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          {formError && (
            <p role="alert" className="text-xs font-medium text-rose-600">
              {formError}
            </p>
          )}
          <Button type="submit" fullWidth loading={submitting}>
            สร้างบัญชี
          </Button>
        </form>
      </Modal>

      {tempPassword && (
        <TempPasswordModal
          open
          onClose={() => setTempPassword(null)}
          email={tempPassword.email}
          tempPassword={tempPassword.value}
        />
      )}
    </div>
  );
}
