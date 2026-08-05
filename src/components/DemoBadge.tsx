import { Info } from "lucide-react";

export default function DemoBadge({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-2">
      <Info size={14} className="mt-0.5 shrink-0" />
      <span>{text}</span>
    </div>
  );
}
