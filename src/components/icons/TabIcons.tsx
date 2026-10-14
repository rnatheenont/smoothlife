import { BookOpen, Heart, Home, LayoutGrid, Percent, ShoppingCart, Sparkles, Tag, User, type LucideIcon } from "lucide-react";
import ScanFaceIcon from "@/components/icons/ScanFaceIcon";

// The marks the bottom bar can wear.
//
// A closed set, for the same reason the content sections have one: a typed
// icon name that matches nothing leaves a hole in a row of five, on the
// control the whole phone experience is navigated by.

export const TAB_ICONS: Record<string, LucideIcon | typeof ScanFaceIcon> = {
  home: Home,
  grid: LayoutGrid,
  "scan-face": ScanFaceIcon,
  cart: ShoppingCart,
  user: User,
  heart: Heart,
  percent: Percent,
  book: BookOpen,
  tag: Tag,
  sparkles: Sparkles,
};

export const TAB_ICON_KEYS = Object.keys(TAB_ICONS);

export const tabIcon = (key: string) => TAB_ICONS[key] ?? Home;
