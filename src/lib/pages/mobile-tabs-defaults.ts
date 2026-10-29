// Split out of mobile-tabs.ts for the same reason header-links-defaults.ts
// was: MobileTabBar.tsx is a client component, it needs this constant, and
// reaching it through the schema module pulled zod (94 KB) into every page.
//
// The type comes from the schema next door as `import type`, which is erased.

import type { MobileTab } from "./mobile-tabs.ts";

export const MOBILE_TABS_DEFAULT: MobileTab[] = [
  { icon: "home", href: "/", th: "หน้าแรก", en: "Home" },
  { icon: "grid", href: "/shop", th: "ช้อป", en: "Shop" },
  { icon: "scan-face", href: "/skin-coach", th: "ประเมินผิว", en: "Skin Check" },
  { icon: "cart", href: "/cart", th: "ตะกร้า", en: "Cart" },
  { icon: "user", href: "/account", th: "บัญชี", en: "Account" },
];
