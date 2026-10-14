import {
  Award,
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
};

export const CONTENT_ICON_KEYS = Object.keys(CONTENT_ICONS);

/** The icon for a key, or nothing. A card with no mark is a card; a card with
 *  a hole where a mark should be is a bug report. */
export function contentIcon(key: string | undefined): LucideIcon | undefined {
  return key ? CONTENT_ICONS[key] : undefined;
}
