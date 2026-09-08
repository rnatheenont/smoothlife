import {
  Banknote,
  Clock,
  CreditCard,
  MessageCircle,
  PackageSearch,
  QrCode,
  RotateCcw,
  Truck,
  type LucideIcon,
} from "lucide-react";

// The help content is plain data so the chat route can import it on the server
// without dragging an icon library along; the pages put the pictures back.
const ICONS: Record<string, LucideIcon> = {
  truck: Truck,
  clock: Clock,
  "package-search": PackageSearch,
  "rotate-ccw": RotateCcw,
  "qr-code": QrCode,
  "credit-card": CreditCard,
  banknote: Banknote,
  "message-circle": MessageCircle,
};

export function helpIcon(key: string): LucideIcon {
  return ICONS[key] ?? MessageCircle;
}
