"use client";

import Script from "next/script";

const FW_BUSINESS_ID = "oBWr6V";
const FW_CHANNEL = "smooth_life";
const FW_PLAYLIST = "o30aB3";

// Real shoppable-video widget, copied verbatim from smoothlife.com's own
// public embed snippet (channel/playlist/business ID are public
// identifiers baked into that page's HTML, not secrets). This is
// Firework's own shoppable-video platform — the store's real paid vendor
// account — so it renders actually-playable videos, but the widget
// manages its own internal UI/scrolling; it can't be restyled or driven
// by our own code. Confirmed working (renders + plays) when tested
// locally, not domain-locked to smoothlife.com.
export default function FireworkVideoFeed() {
  return (
    <>
      <Script type="module" src="https://asset.fwcdn3.com/js/module/integrations/shopify.js" strategy="lazyOnload" />
      <Script type="module" src={`https://asset.fwcdn3.com/js/module/fwn.js?business_id=${FW_BUSINESS_ID}`} strategy="lazyOnload" />
      <fw-embed-feed
        channel={FW_CHANNEL}
        playlist={FW_PLAYLIST}
        size="large"
        open_in="default"
        widget_source="auto_embed_shopify"
        title=""
        branding="false"
        title_alignment="center"
        auto_embed_widget="true"
        mode="row"
      />
    </>
  );
}
