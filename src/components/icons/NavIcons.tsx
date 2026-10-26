import {
  BookOpen,
  Droplets,
  Heart,
  HelpCircle,
  LayoutGrid,
  Percent,
  Repeat,
  ScanFace,
  ShieldCheck,
  Sparkles,
  Tag,
  Users,
  type LucideIcon,
} from "lucide-react";

// The marks the drawer's links can wear — the ones the drawer already
// uses, by the names the stored document refers to them by. A closed set,
// because a mistyped name in the main menu is a blank space in the only
// navigation a phone has.

export const NAV_ICONS: Record<string, LucideIcon> = {
  grid: LayoutGrid,
  tag: Tag,
  percent: Percent,
  droplets: Droplets,
  repeat: Repeat,
  scan: ScanFace,
  sparkles: Sparkles,
  book: BookOpen,
  heart: Heart,
  users: Users,
  shield: ShieldCheck,
  help: HelpCircle,
};

export const NAV_ICON_KEYS = Object.keys(NAV_ICONS);

export const navIcon = (key: string): LucideIcon => NAV_ICONS[key] ?? LayoutGrid;
