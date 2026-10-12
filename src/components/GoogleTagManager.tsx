import Script from "next/script";

// The team's existing Google Tag Manager container, on the Next app.
//
// Same container as the Shopify theme (see the admin notes): one container
// means one place to add or remove a tag, and the two halves of the shop
// stop reporting into different buckets.
//
// Off unless NEXT_PUBLIC_GTM_ID is set, the same way the page system's own
// switches work. That is deliberate rather than cautious: whatever tags are
// already configured inside the container start firing for every customer
// the moment this loads, and that is a decision to make on purpose, on a
// day somebody is watching, not as a side effect of a deploy.
//
// afterInteractive, not beforeInteractive: GTM is measurement, and nothing
// on the page waits for it. Loading it earlier would put a third-party
// script in front of the shop's own first render.
//
// No consent gate here. The container is the right place for that — GTM has
// consent mode built in and the team already runs this container on the
// Shopify side — so adding a second, different gate in this app would be two
// answers to one question.

export const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID ?? "";

export default function GoogleTagManager() {
  if (!GTM_ID) return null;

  return (
    <>
      <Script id="gtm-init" strategy="afterInteractive">
        {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});
var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';
j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');`}
      </Script>
      {/* The <noscript> iframe GTM asks for. It is the only way a visitor
          with JavaScript off is counted at all, and it costs nothing when
          JavaScript is on. */}
      <noscript>
        <iframe
          src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
          height="0"
          width="0"
          style={{ display: "none", visibility: "hidden" }}
          title="Google Tag Manager"
        />
      </noscript>
    </>
  );
}
