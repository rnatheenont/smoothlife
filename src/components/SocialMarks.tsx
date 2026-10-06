// lucide carries no TikTok or LINE mark, so these two are drawn here. Shared
// by the site footer and the campaign pages' own footer, which list the same
// four channels — before this they were a private copy inside StoreChrome.

export function TikTokMark({ size = 20 }: { size?: number; "aria-hidden"?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 1 1-1.79-2.46V9.78a5.87 5.87 0 1 0 4.88 5.78V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3a4.28 4.28 0 0 1-3.24-1.48Z" />
    </svg>
  );
}

export function LineMark({ size = 20 }: { size?: number; "aria-hidden"?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2C6.48 2 2 5.64 2 10.13c0 4.02 3.55 7.39 8.35 8.03.33.07.77.22.88.5.1.26.07.66.03.92l-.14.85c-.04.25-.2.99.87.54s5.77-3.4 7.87-5.82c1.45-1.59 2.14-3.2 2.14-4.99C22 5.64 17.52 2 12 2ZM8.1 12.85H6.06a.27.27 0 0 1-.27-.27V8.5a.27.27 0 0 1 .27-.27h.53c.15 0 .27.12.27.27v3.28H8.1c.15 0 .27.12.27.27v.53c0 .15-.12.27-.27.27Zm1.6-.27c0 .15-.12.27-.27.27h-.53a.27.27 0 0 1-.27-.27V8.5c0-.15.12-.27.27-.27h.53c.15 0 .27.12.27.27v4.08Zm4.42 0c0 .15-.12.27-.27.27h-.53a.27.27 0 0 1-.21-.11l-1.87-2.52v2.36c0 .15-.12.27-.27.27h-.53a.27.27 0 0 1-.27-.27V8.5c0-.15.12-.27.27-.27h.55c.08 0 .16.04.21.11l1.85 2.5V8.5c0-.15.12-.27.27-.27h.53c.15 0 .27.12.27.27v4.08Zm3.55-3.55c0 .15-.12.27-.27.27h-1.51v.58h1.51c.15 0 .27.12.27.27v.53c0 .15-.12.27-.27.27h-1.51v.58h1.51c.15 0 .27.12.27.27v.53c0 .15-.12.27-.27.27h-2.31a.27.27 0 0 1-.27-.27V8.5c0-.15.12-.27.27-.27h2.31c.15 0 .27.12.27.27v.53Z" />
    </svg>
  );
}
