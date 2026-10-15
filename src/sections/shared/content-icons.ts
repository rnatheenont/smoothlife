import {
  Award,
  BadgeCheck,
  Banknote,
  CreditCard,
  FlaskConical,
  GraduationCap,
  Handshake,
  HeartHandshake,
  HeartPulse,
  PackageCheck,
  PackageSearch,
  QrCode,
  Recycle,
  Stethoscope,
  Users2,
  WifiOff,
  BookOpen,
  Clock,
  Gift,
  Heart,
  HelpCircle,
  Leaf,
  MapPin,
  MessageCircle,
  Microscope,
  Package,
  Phone,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Camera,
  Star,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";

// The small set of marks the content sections can put on a card.
//
// A closed set rather than "type the name of any lucide icon", because the
// difference between the two is who finds out when it is wrong: with a list,
// the editor offers what exists; with a free text field, the admin types
// "shield-check", gets nothing, and the card looks broken on the live site.
//
// Kept to eighteen on purpose. Every one of them already appears somewhere on
// the shop, so a page built from these looks like the rest of the site rather
// than like a different product.

export const CONTENT_ICONS: Record<string, LucideIcon> = {
  shield: ShieldCheck,
  truck: Truck,
  "rotate-ccw": RotateCcw,
  package: Package,
  leaf: Leaf,
  heart: Heart,
  award: Award,
  sparkles: Sparkles,
  camera: Camera,
  star: Star,
  message: MessageCircle,
  phone: Phone,
  "map-pin": MapPin,
  clock: Clock,
  help: HelpCircle,
  book: BookOpen,
  gift: Gift,
  users: Users,
  microscope: Microscope,
  // Added for the content pages moving into the system: these are the exact
  // marks those pages already draw, so a page can move across without its
  // icons changing. A near-enough icon would have been a visible edit nobody
  // asked for.
  "badge-check": BadgeCheck,
  flask: FlaskConical,
  "package-check": PackageCheck,
  stethoscope: Stethoscope,
  graduation: GraduationCap,
  "heart-handshake": HeartHandshake,
  handshake: Handshake,
  recycle: Recycle,
  "users-2": Users2,
  "heart-pulse": HeartPulse,
  // Keyed the way src/data/help.ts already keys them, so the help topics
  // carry their marks across without a translation table in between.
  "package-search": PackageSearch,
  "qr-code": QrCode,
  "credit-card": CreditCard,
  banknote: Banknote,
  "message-circle": MessageCircle,
  "wifi-off": WifiOff,
};

export const CONTENT_ICON_KEYS = Object.keys(CONTENT_ICONS);

/** The icon for a key, or nothing. A card with no mark is a card; a card with
 *  a hole where a mark should be is a bug report. */
export function contentIcon(key: string | undefined): LucideIcon | undefined {
  return key ? CONTENT_ICONS[key] : undefined;
}
