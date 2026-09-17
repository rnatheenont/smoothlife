// A notice for browsers too old for the site's CSS (Tailwind v4 and HeroUI v3
// need Safari / iOS 16.4+, Chrome 111+, Firefox 128+). On those, styling
// partly falls apart, so the visitor is told why and how to fix it rather
// than left with a broken-looking shop.
//
// It has to work exactly where the rest of the site doesn't: plain ES5, no
// React, inline styles only, and it runs before anything else loads.
// `color-mix()` is the newest CSS feature the stylesheet depends on, so a
// browser without it is the one that needs the notice.
//
// Shown once per browser until dismissed; each showing is also counted in
// Vercel Analytics (event "old_browser_notice") so we can see how many
// visitors are affected.

const SCRIPT = `(function () {
  try {
    if (window.CSS && CSS.supports && CSS.supports("color", "color-mix(in srgb, red, blue)")) return;
    try { if (localStorage.getItem("sl-old-browser-dismissed")) return; } catch (e) {}
    var bar = document.createElement("div");
    bar.setAttribute("role", "alert");
    bar.style.cssText = "position:relative;z-index:2147483647;background:#fff7e6;color:#5c3b00;border-bottom:1px solid #f0d49c;padding:12px 44px 12px 16px;font:14px/1.5 sans-serif;text-align:left;";
    bar.innerHTML = "<strong>เบราว์เซอร์ของคุณเป็นรุ่นเก่า</strong> หน้าเว็บบางส่วนอาจแสดงผลไม่ถูกต้อง กรุณาอัปเดต iOS (ตั้งค่า &gt; ทั่วไป &gt; รายการอัปเดตซอฟต์แวร์) หรืออัปเดตเบราว์เซอร์เป็นเวอร์ชันล่าสุด";
    var close = document.createElement("button");
    close.setAttribute("type", "button");
    close.setAttribute("aria-label", "ปิด");
    close.innerHTML = "&times;";
    close.style.cssText = "position:absolute;top:6px;right:6px;width:36px;height:36px;border:0;background:transparent;color:#5c3b00;font-size:22px;line-height:36px;cursor:pointer;";
    close.onclick = function () {
      try { localStorage.setItem("sl-old-browser-dismissed", "1"); } catch (e) {}
      if (bar.parentNode) bar.parentNode.removeChild(bar);
    };
    bar.appendChild(close);
    document.body.insertBefore(bar, document.body.firstChild);
    setTimeout(function () {
      try { if (window.va) window.va("event", { name: "old_browser_notice" }); } catch (e) {}
    }, 4000);
  } catch (e) {}
})();`;

export default function OldBrowserNotice() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}
