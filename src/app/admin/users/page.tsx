"use client";

import { useEffect, useState } from "react";
import {
  UserCog,
  Plus,
  Copy,
  Check,
  KeyRound,
  Ban,
  Pencil,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { Badge, Field, Modal } from "@/components/ui";
import { useAdminAction } from "@/components/admin/header-action";
import { PageHeader, Panel, adminTable } from "@/components/admin/layout-kit";
import AdminSelect from "@/components/admin/AdminSelect";
import { Button } from "@heroui/react";

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
  return new Date(iso).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "2-digit",
    timeZone: "Asia/Bangkok",
  });
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
    <Modal
      open={open}
      onClose={onClose}
      title="รหัสผ่านชั่วคราว"
      description={`สำหรับ ${email} — เห็นได้แค่ครั้งนี้ครั้งเดียว`}
    >
      <div className="flex items-center gap-2 rounded-lg border border-dashed border-brand-teal/40 bg-brand-gradient-soft px-3 py-2.5">
        <code className="min-w-0 flex-1 truncate text-sm font-semibold text-brand-ink">
          {tempPassword}
        </code>
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
        ส่งรหัสผ่านนี้ให้เจ้าของบัญชีทางช่องทางที่ปลอดภัย (ไม่ใช่แชทสาธารณะ)
        แนะนำให้เปลี่ยนรหัสผ่านทันทีหลังเข้าใช้งานครั้งแรก
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

  const [tempPassword, setTempPassword] = useState<{
    email: string;
    value: string;
  } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Rename and delete each open their own dialog: one needs a field, the
  // other needs the account named back at you before it goes.
  const [renaming, setRenaming] = useState<AdminUserRow | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [emailValue, setEmailValue] = useState("");
  const [renameError, setRenameError] = useState("");
  const [renameBusy, setRenameBusy] = useState(false);
  const [deleting, setDeleting] = useState<AdminUserRow | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    const [meRes, usersRes] = await Promise.all([
      fetch("/api/admin/me"),
      fetch("/api/admin/users"),
    ]);
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
      setTempPassword({
        email: data.user.email,
        value: data.user.tempPassword,
      });
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
        if (target)
          setTempPassword({ email: target.email, value: data.tempPassword });
        return;
      }
      setUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, ...data.user } : u)),
      );
    } finally {
      setBusyId(null);
    }
  }

  function openRename(u: AdminUserRow) {
    setRenaming(u);
    setRenameValue(u.display_name);
    setEmailValue(u.email);
    setRenameError("");
  }

  async function submitRename(e: React.FormEvent) {
    e.preventDefault();
    if (!renaming) return;
    const name = renameValue.trim();
    if (!name) {
      setRenameError("กรุณากรอกชื่อที่ใช้แสดงผล");
      return;
    }
    const email = emailValue.trim().toLowerCase();
    if (!email) {
      setRenameError("กรุณากรอกอีเมล");
      return;
    }
    setRenameError("");
    setRenameBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${renaming.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: name, email }),
      });
      const data = await res.json().catch(() => null);
      if (!data?.ok) {
        setRenameError(data?.error || "บันทึกไม่สำเร็จ");
        return;
      }
      setUsers((prev) =>
        prev.map((u) => (u.id === renaming.id ? { ...u, ...data.user } : u)),
      );
      setRenaming(null);
    } catch {
      setRenameError("บันทึกไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setRenameBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteError("");
    setDeleteBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${deleting.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => null);
      if (!data?.ok) {
        // The common failure is "this account has done work" — a sentence
        // long enough to belong in the dialog rather than an alert.
        setDeleteError(data?.error || "ลบบัญชีไม่สำเร็จ");
        return;
      }
      setUsers((prev) => prev.filter((u) => u.id !== deleting.id));
      setDeleting(null);
    } catch {
      setDeleteError("ลบบัญชีไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={<UserCog size={20} className="text-brand-emerald" />}
        title="ผู้ใช้ & สิทธิ์"
        subtitle="จัดการว่าใครเข้าระบบหลังบ้านได้บ้าง และแต่ละคนทำอะไรได้บ้าง — เฉพาะเจ้าของระบบเท่านั้นที่เห็นหน้านี้"
      />

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">กำลังโหลด…</p>
      ) : error ? (
        <div className="rounded-xl2 border border-dashed border-slate-200 py-10 text-center">
          <p className="text-sm text-slate-500">{error}</p>
        </div>
      ) : (
        <Panel
          title="บัญชีทั้งหมด"
          icon={<UserCog size={15} className="text-brand-600" />}
        >
          {/* A table on a screen with room for one, because the questions
              asked here are comparisons — who has which permission, who has
              not signed in — and the controls were sitting wherever the name
              above them happened to end. Below md each account is a card:
              a select and two buttons do not fit a phone's table row. */}
          <div className="hidden md:block">
            <table className={adminTable.table}>
              <thead className={adminTable.thead}>
                <tr>
                  <th>ผู้ใช้</th>
                  <th className="w-56">สิทธิ์</th>
                  <th className="w-40">เข้าระบบล่าสุด</th>
                  <th className="w-72 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isSelf = me?.id === u.id;
                  return (
                    <tr key={u.id} className={adminTable.row}>
                      <td className={adminTable.cell}>
                        <p className="flex flex-wrap items-center gap-1.5 font-semibold text-brand-ink">
                          {u.display_name}
                          {/* Beside the name rather than out in the actions
                              column: it edits the thing it sits next to. */}
                          <button
                            type="button"
                            onClick={() => openRename(u)}
                            aria-label={`แก้ชื่อและอีเมลของ ${u.display_name}`}
                            title="แก้ชื่อและอีเมล"
                            className="grid size-9 shrink-0 place-items-center rounded-full text-slate-400 hover:bg-surface-soft hover:text-brand-ink"
                          >
                            <Pencil size={13} aria-hidden="true" />
                          </button>
                          {isSelf && <Badge tone="brand">คุณ</Badge>}
                          {u.status === "suspended" && (
                            <Badge tone="danger">ระงับการใช้งาน</Badge>
                          )}
                        </p>
                        <p className="text-[12px] text-slate-400">{u.email}</p>
                      </td>
                      <td className={adminTable.cell}>
                        <AdminSelect
                          label={`สิทธิ์ของ ${u.display_name}`}
                          value={u.role_key}
                          isDisabled={isSelf || busyId === u.id}
                          onChange={(v) => patchUser(u.id, { role_key: v })}
                          className="w-full"
                          triggerClassName="w-full"
                          options={roles.map((r) => ({
                            value: r.key,
                            label: r.label,
                          }))}
                        />
                      </td>
                      <td className={adminTable.muted}>
                        {formatDate(u.last_login_at)}
                      </td>
                      <td className={adminTable.cell}>
                        <span className="flex flex-wrap justify-end gap-1.5">
                          <Button
                            variant="secondary"
                            size="sm"
                            isDisabled={busyId === u.id}
                            onPress={() =>
                              patchUser(u.id, { reset_password: true })
                            }
                          >
                            <KeyRound size={13} /> ตั้งรหัสผ่านใหม่
                          </Button>
                          <Button
                            variant={
                              u.status === "active" ? "danger" : "secondary"
                            }
                            size="sm"
                            isDisabled={isSelf || busyId === u.id}
                            onPress={() =>
                              patchUser(u.id, {
                                status:
                                  u.status === "active"
                                    ? "suspended"
                                    : "active",
                              })
                            }
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
                          {/* Icon only, and last: suspending is the everyday
                              action, deleting is the one there is no undo for. */}
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteError("");
                              setDeleting(u);
                            }}
                            disabled={isSelf || busyId === u.id}
                            aria-label={`ลบบัญชีของ ${u.display_name}`}
                            title={isSelf ? "ลบบัญชีตัวเองไม่ได้" : "ลบบัญชี"}
                            className="grid size-9 shrink-0 place-items-center rounded-full text-rose-500 hover:bg-rose-50 disabled:opacity-30 disabled:hover:bg-transparent"
                          >
                            <Trash2 size={14} aria-hidden="true" />
                          </button>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <ul className="divide-y divide-slate-100 md:hidden">
            {users.map((u) => {
              const isSelf = me?.id === u.id;
              return (
                <li key={u.id} className="p-3">
                  <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-brand-ink">
                    {u.display_name}
                    <button
                      type="button"
                      onClick={() => openRename(u)}
                      aria-label={`แก้ชื่อและอีเมลของ ${u.display_name}`}
                      title="แก้ชื่อและอีเมล"
                      className="grid size-9 shrink-0 place-items-center rounded-full text-slate-400 hover:bg-surface-soft hover:text-brand-ink"
                    >
                      <Pencil size={13} aria-hidden="true" />
                    </button>
                    {isSelf && <Badge tone="brand">คุณ</Badge>}
                    {u.status === "suspended" && (
                      <Badge tone="danger">ระงับการใช้งาน</Badge>
                    )}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {u.email} · เข้าระบบล่าสุด {formatDate(u.last_login_at)}
                  </p>
                  <AdminSelect
                    label={`สิทธิ์ของ ${u.display_name}`}
                    value={u.role_key}
                    isDisabled={isSelf || busyId === u.id}
                    onChange={(v) => patchUser(u.id, { role_key: v })}
                    className="mt-2 w-full"
                    triggerClassName="w-full"
                    options={roles.map((r) => ({
                      value: r.key,
                      label: r.label,
                    }))}
                  />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Button
                      variant="secondary"
                      size="sm"
                      isDisabled={busyId === u.id}
                      onPress={() => patchUser(u.id, { reset_password: true })}
                    >
                      <KeyRound size={13} /> ตั้งรหัสผ่านใหม่
                    </Button>
                    <Button
                      variant={u.status === "active" ? "danger" : "secondary"}
                      size="sm"
                      isDisabled={isSelf || busyId === u.id}
                      onPress={() =>
                        patchUser(u.id, {
                          status:
                            u.status === "active" ? "suspended" : "active",
                        })
                      }
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
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteError("");
                        setDeleting(u);
                      }}
                      disabled={isSelf || busyId === u.id}
                      aria-label={`ลบบัญชีของ ${u.display_name}`}
                      title={isSelf ? "ลบบัญชีตัวเองไม่ได้" : "ลบบัญชี"}
                      className="grid size-9 shrink-0 place-items-center rounded-full text-rose-500 hover:bg-rose-50 disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="เพิ่มผู้ใช้ใหม่"
        description="ระบบจะออกรหัสผ่านชั่วคราวให้ทันที"
      >
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
            onChange={(e) =>
              setForm((f) => ({ ...f, display_name: e.target.value }))
            }
            placeholder="เช่น น้ำฝน (ทีมแชท)"
          />
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              สิทธิ์ <span className="text-rose-700">*</span>
            </label>
            <AdminSelect
              label="สิทธิ์"
              placeholder="เลือกสิทธิ์"
              value={form.role_key}
              onChange={(v) => setForm((f) => ({ ...f, role_key: v }))}
              className="w-full"
              // Not a pill here: it sits in a stack of form fields with square
              // corners, and a capsule among them reads as a different control.
              triggerClassName="w-full rounded-lg"
              options={roles.map((r) => ({ value: r.key, label: r.label }))}
            />
          </div>
          {formError && (
            <p role="alert" className="text-xs font-medium text-rose-600">
              {formError}
            </p>
          )}
          <Button type="submit" fullWidth isPending={submitting}>
            สร้างบัญชี
          </Button>
        </form>
      </Modal>

      {renaming && (
        <Modal
          open
          onClose={() => setRenaming(null)}
          title="แก้ชื่อและอีเมล"
          description={renaming.display_name}
        >
          <form onSubmit={submitRename} className="space-y-3">
            <Field
              label="ชื่อที่ใช้แสดงผล"
              required
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="เช่น น้ำฝน (ทีมแชท)"
            />
            <p className="text-xs text-slate-500">
              ชื่อนี้ขึ้นในบันทึกการใช้งานและหน้าเนื้อหาสินค้า
              แก้แล้วงานเก่าจะขึ้นเป็นชื่อใหม่ด้วย
            </p>
            <Field
              label="อีเมล"
              type="email"
              required
              value={emailValue}
              onChange={(e) => setEmailValue(e.target.value)}
              placeholder="name@smooth-e.com"
            />
            {/* The email is the login, so this says what actually changes —
                not "this field is the email", which the label already said. */}
            <p className="text-xs text-slate-500">
              {emailValue.trim().toLowerCase() !==
              renaming.email.trim().toLowerCase()
                ? `เปลี่ยนแล้ว ${renaming.email} จะเข้าระบบไม่ได้อีก ต้องใช้อีเมลใหม่แทน${
                    me?.id === renaming.id ? " — รวมถึงการเข้าระบบของคุณเอง" : ""
                  }`
                : "อีเมลนี้คือชื่อผู้ใช้สำหรับเข้าระบบ และเป็นที่อยู่ที่ลิงก์ตั้งรหัสผ่านใหม่ถูกส่งไป"}
            </p>
            {renameError && (
              <p role="alert" className="text-xs font-medium text-rose-600">
                {renameError}
              </p>
            )}
            <Button type="submit" fullWidth isPending={renameBusy}>
              บันทึก
            </Button>
          </form>
        </Modal>
      )}

      {deleting && (
        <Modal
          open
          onClose={() => setDeleting(null)}
          size="sm"
          title="ลบบัญชีนี้"
          description={`${deleting.display_name} · ${deleting.email}`}
          footer={
            <>
              <Button variant="outline" onPress={() => setDeleting(null)}>
                ยกเลิก
              </Button>
              <Button
                variant="danger"
                isPending={deleteBusy}
                onPress={confirmDelete}
              >
                <Trash2 size={14} /> ลบบัญชี
              </Button>
            </>
          }
        >
          <p className="text-sm text-slate-600">
            ลบแล้วบัญชีนี้เข้าระบบไม่ได้อีก และกู้คืนไม่ได้ —
            ถ้าแค่อยากปิดการเข้าใช้ไว้ก่อน ใช้ “ระงับ” แทน
          </p>
          {deleteError && (
            <p role="alert" className="mt-3 text-xs font-medium text-rose-600">
              {deleteError}
            </p>
          )}
        </Modal>
      )}

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
