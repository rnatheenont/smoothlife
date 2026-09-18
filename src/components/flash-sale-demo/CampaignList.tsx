"use client";

import Image from "next/image";
import { Button, Card, Chip } from "@heroui/react";
import { CalendarClock, Pencil, Play, Plus, Square, Trash2 } from "lucide-react";
import { countdown, thaiDateTime, type ScheduledCampaign } from "./scheduler";

const END_REASON = { sold_out: "ขายหมด", time_up: "ครบเวลา", manual: "ปิดเอง" } as const;

/**
 * Admin: every campaign, in start order, with where it stands. Scheduled ones
 * open by themselves at their start time; running ones close at their end
 * time (or when every product sells out). Start / end now are overrides.
 */
export default function CampaignList({
  items,
  now,
  loading = false,
  currentId,
  editingId,
  pick,
  startNow,
  endNow,
  edit,
  newCampaign,
  remove,
}: {
  items: ScheduledCampaign[];
  now: number;
  loading?: boolean;
  currentId?: string;
  /** The campaign the form below is editing, if any. */
  editingId?: string | null;
  pick: (id: string) => void;
  startNow: (id: string) => void;
  endNow: (id: string) => void;
  edit: (id: string) => void;
  /** Leave edit mode and start a blank campaign in the form below. */
  newCampaign: () => void;
  remove: (id: string) => void;
}) {
  const running = items.filter((i) => i.status === "running").length;
  const scheduled = items.filter((i) => i.status === "scheduled").length;

  return (
    <Card className="p-5 md:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="flex items-center gap-2 text-lg font-bold text-brand-ink">
          <CalendarClock size={20} className="text-brand-800" aria-hidden /> 1 · รายการแคมเปญ
        </h3>
        <div className="flex items-center gap-3">
          <p className="text-sm text-slate-500">
            กำลังขาย {running} · รอเริ่ม {scheduled} · ทั้งหมด {items.length}
          </p>
          <Button size="sm" onPress={newCampaign}>
            <Plus size={14} aria-hidden /> สร้างแคมเปญใหม่
          </Button>
        </div>
      </div>
      <p className="mt-1 text-xs text-slate-500">เปิดและปิดการขายอัตโนมัติตามวันเวลา กดที่แคมเปญเพื่อดูตัวเลขและมุมมองลูกค้า</p>

      {items.length === 0 ? (
        <p className="mt-6 text-center text-sm text-slate-500">{loading ? "กำลังโหลดรายการจากฐานข้อมูล…" : "ยังไม่มีแคมเปญ สร้างแคมเปญแรกได้ด้านล่าง"}</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2.5">
          {items.map((i) => {
            const sales = i.campaign?.sales ?? [];
            const total = i.config.stockPerProduct * i.config.products.length;
            const sold = sales.reduce((t, s) => t + s.sale.sold, 0);
            const isCurrent = i.id === currentId;
            return (
              <li
                key={i.id}
                className={`rounded-xl2 ring-1 transition ${isCurrent ? "bg-brand-50/60 ring-brand-800" : "bg-white ring-surface-line"}`}
              >
                <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
                  <button type="button" onClick={() => pick(i.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-pressed={isCurrent}>
                    <span className="flex shrink-0 -space-x-3">
                      {i.config.products.slice(0, 3).map((p) => (
                        <span key={p.slug} className="relative h-11 w-11 overflow-hidden rounded-lg bg-white ring-2 ring-white">
                          <Image src={p.image} alt="" fill sizes="44px" className="object-contain p-0.5" />
                        </span>
                      ))}
                    </span>
                    <span className="min-w-0">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate text-sm font-semibold text-brand-ink">{i.config.title}</span>
                        {i.config.kind === "special" && (
                          <Chip size="sm" variant="soft" color="accent">
                            พิเศษ
                          </Chip>
                        )}
                      </span>
                      <span className="block text-xs text-slate-500" suppressHydrationWarning>
                        {thaiDateTime(i.startsAt)} → {i.endsAt ? thaiDateTime(i.endsAt) : "จนกว่าของหมด"}
                      </span>
                      <span className="block text-xs text-slate-400">
                        {i.config.products.length} สินค้า · {total} ชิ้น · ชำระภายใน {i.config.windowMinutes} นาที
                      </span>
                    </span>
                  </button>

                  <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 sm:justify-end">
                    <Button
                      size="sm"
                      variant={i.id === editingId ? "secondary" : "ghost"}
                      onPress={() => edit(i.id)}
                      aria-pressed={i.id === editingId}
                    >
                      <Pencil size={13} aria-hidden /> แก้ไข
                    </Button>
                    {i.status === "scheduled" && (
                      <>
                        <Chip size="sm" variant="soft" color="warning">
                          <span suppressHydrationWarning>เริ่มในอีก {countdown(i.startsAt - now)}</span>
                        </Chip>
                        <div className="flex gap-1">
                          <Button size="sm" variant="secondary" onPress={() => startNow(i.id)}>
                            <Play size={13} aria-hidden /> เริ่มทันที
                          </Button>
                          <Button size="sm" variant="ghost" onPress={() => endNow(i.id)}>
                            ยกเลิก
                          </Button>
                          <Button size="sm" variant="ghost" isIconOnly aria-label="ลบแคมเปญ" onPress={() => remove(i.id)}>
                            <Trash2 size={15} aria-hidden />
                          </Button>
                        </div>
                      </>
                    )}
                    {i.status === "running" && (
                      <>
                        <Chip size="sm" variant="soft" color="danger">
                          กำลังขาย {sold}/{total}
                          {i.endsAt ? <span suppressHydrationWarning> · ปิดในอีก {countdown(i.endsAt - now)}</span> : null}
                        </Chip>
                        <Button size="sm" variant="secondary" onPress={() => endNow(i.id)}>
                          <Square size={12} aria-hidden /> ปิดการขาย
                        </Button>
                      </>
                    )}
                    {i.status === "ended" && (
                      <>
                        <Chip size="sm" variant="soft" color="default">
                          {i.campaign ? `จบแล้ว · ${i.endReason ? END_REASON[i.endReason] : ""} · ขาย ${sold}/${total}` : "ยกเลิกก่อนเริ่ม"}
                        </Chip>
                        <Button size="sm" variant="ghost" isIconOnly aria-label="ลบแคมเปญ" onPress={() => remove(i.id)}>
                          <Trash2 size={15} aria-hidden />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
