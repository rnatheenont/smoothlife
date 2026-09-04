"use client";

import { useState } from "react";
import clsx from "clsx";
import {
  CheckCircle2,
  Circle,
  Copy,
  Check,
  ExternalLink,
  Package,
  Truck,
  Home,
  ClipboardList,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui";
import { furthestStep } from "@/lib/shipment";
import type { StepKey, Step } from "@/lib/shipment";
import type { TrackedShipment } from "@/lib/tracking";

// The parcel tracker, shared by /account/orders and the signed-out /track.
//
// Steps past "เข้าระบบขนส่งแล้ว" stay grey until something proves otherwise.
// Shopify gives us the handover and nothing after it, so a tracker that lit
// up "กำลังนำจ่าย" on a timer would be inventing the one fact the customer
// actually came here for.

const STEP_ICON: Record<StepKey, typeof Package> = {
  confirmed: ClipboardList,
  processing: Package,
  shipped: Truck,
  out_for_delivery: Truck,
  delivered: Home,
};

function formatThaiDateTime(iso: string) {
  return new Date(iso).toLocaleString("th-TH", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Stepper({ steps }: { steps: Step[] }) {
  return (
    <ol className="flex items-start">
      {steps.map((step, i) => {
        const Icon = STEP_ICON[step.key];
        const reached = step.state !== "todo";
        return (
          <li key={step.key} className="relative flex min-w-0 flex-1 flex-col items-center">
            {/* Connector sits behind the dot and stops at the last step. */}
            {i > 0 && (
              <span
                aria-hidden
                className={clsx(
                  "absolute right-1/2 top-4 h-0.5 w-full",
                  reached ? "bg-brand-400" : "bg-slate-200"
                )}
              />
            )}
            <span
              className={clsx(
                "relative z-10 grid h-8 w-8 place-items-center rounded-full border-2 bg-white",
                step.state === "current"
                  ? "border-brand-600 text-brand-800 shadow-layer-xs"
                  : step.state === "done"
                    ? "border-brand-400 text-brand-600"
                    : "border-slate-200 text-slate-300"
              )}
            >
              <Icon size={15} />
            </span>
            <span
              className={clsx(
                "mt-1.5 text-center text-[10px] leading-tight",
                reached ? "font-semibold text-brand-ink" : "text-slate-400"
              )}
            >
              {step.label}
            </span>
            {step.at && (
              <span className="mt-0.5 text-center text-[9px] text-slate-400">
                {formatThaiDateTime(step.at)}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function TrackingNumber({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        });
      }}
      className="inline-flex items-center gap-1.5 rounded-full bg-surface-soft px-3 py-1 font-mono text-xs font-semibold text-brand-800 transition hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
    >
      {value}
      {copied ? <Check size={12} /> : <Copy size={12} />}
      <span className="sr-only">คัดลอกเลขพัสดุ</span>
    </button>
  );
}

function ShipmentCard({
  shipment,
  hasCourierFeed,
  index,
  total,
}: {
  shipment: TrackedShipment;
  hasCourierFeed: boolean;
  index: number;
  total: number;
}) {
  // Only while "handed to the courier" is the *furthest* thing we know. Once
  // the parcel is delivered there is nothing left to go and look up.
  const stalledAtShipped = furthestStep(shipment.steps) === "shipped";

  return (
    <div className="rounded-xl2 border border-slate-100 p-4">
      {total > 1 && (
        <p className="mb-2 text-[11px] font-semibold text-slate-400">
          กล่องที่ {index + 1} จาก {total}
        </p>
      )}

      <div className="mb-4 px-1">
        <Stepper steps={shipment.steps} />
      </div>

      {shipment.trackingNumber ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          <span className="text-xs text-slate-500">{shipment.courierLabel}</span>
          <TrackingNumber value={shipment.trackingNumber} />
          {shipment.trackingUrl && (
            <Button
              href={shipment.trackingUrl}
              target="_blank"
              rel="noopener noreferrer"
              variant="secondary"
              size="sm"
              className="ml-auto"
            >
              ดูที่เว็บ {shipment.courierLabel} <ExternalLink size={12} />
            </Button>
          )}
        </div>
      ) : (
        <p className="border-t border-slate-100 pt-3 text-xs text-slate-500">
          ยังไม่ได้เลขพัสดุ — จะขึ้นให้อัตโนมัติเมื่อร้านส่งของเข้าระบบขนส่งแล้ว
        </p>
      )}

      {shipment.events.length > 0 && (
        <ol className="mt-3 space-y-2 border-t border-slate-100 pt-3">
          {shipment.events.map((e, i) => (
            <li key={`${e.eventTime}-${i}`} className="flex gap-2">
              {i === 0 ? (
                <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-brand-600" />
              ) : (
                <Circle size={14} className="mt-0.5 shrink-0 text-slate-300" />
              )}
              <div className="min-w-0">
                <p className="text-xs font-medium text-brand-ink">{e.statusText}</p>
                <p className="text-[10px] text-slate-400">
                  {formatThaiDateTime(e.eventTime)}
                  {e.locationName ? ` · ${e.locationName}` : ""}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}

      {/* The honest bit. Without a courier feed we know the parcel was handed
          over and nothing after that, so we say exactly that and point at the
          one place that does know, rather than leaving three grey steps to be
          read as "stuck". */}
      {stalledAtShipped && !hasCourierFeed && shipment.trackingUrl && (
        <p className="mt-3 flex items-start gap-1.5 rounded-m bg-sand-50 p-2.5 text-[11px] leading-relaxed text-slate-500">
          <Info size={12} className="mt-0.5 shrink-0 text-slate-400" />
          <span>
            ตอนนี้เรายืนยันได้ถึงขั้น &ldquo;เข้าระบบขนส่งแล้ว&rdquo; เท่านั้น —
            ความคืบหน้าระหว่างทางดูได้ที่หน้าติดตามของ {shipment.courierLabel}
          </span>
        </p>
      )}
    </div>
  );
}

export default function ShipmentTracker({
  orderName,
  shipments,
  hasCourierFeed,
}: {
  orderName?: string;
  shipments: TrackedShipment[];
  hasCourierFeed: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      {orderName && (
        <p className="text-sm font-bold text-brand-ink">คำสั่งซื้อ {orderName}</p>
      )}
      {shipments.map((s, i) => (
        <ShipmentCard
          key={s.trackingNumber || `pending-${i}`}
          shipment={s}
          hasCourierFeed={hasCourierFeed}
          index={i}
          total={shipments.length}
        />
      ))}
    </div>
  );
}
