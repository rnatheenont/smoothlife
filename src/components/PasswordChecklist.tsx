"use client";

import { Check } from "lucide-react";

// Live checklist for a new-password field — ticks off each requirement as
// the customer types instead of only surfacing a single pass/fail message
// after they submit. Rules mirror lib/password-policy.ts's
// isPasswordStrongEnough (kept as separate literal checks here so each one
// can be shown individually rather than as one combined boolean).
export default function PasswordChecklist({ password }: { password: string }) {
  const rules = [
    { label: "อย่างน้อย 8 ตัวอักษร", met: password.length >= 8 },
    { label: "มีตัวอักษร", met: /[A-Za-z]/.test(password) },
    { label: "มีตัวเลข", met: /[0-9]/.test(password) },
  ];
  return (
    <ul className="flex flex-col gap-1 mt-1.5 ml-1">
      {rules.map((r) => (
        <li key={r.label} className={`flex items-center gap-1.5 text-xs ${r.met ? "text-brand-emerald" : "text-slate-400"}`}>
          <span
            className={`grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full ${
              r.met ? "bg-brand-emerald text-white" : "border border-slate-300"
            }`}
          >
            {r.met && <Check size={9} strokeWidth={3} />}
          </span>
          {r.label}
        </li>
      ))}
    </ul>
  );
}
