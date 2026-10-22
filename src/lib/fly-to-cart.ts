// The picked-up thing flying to the cart.
//
// A copy of the card's own photo, moved with the Web Animations API and
// thrown away when it lands: no state, no re-render, and nothing left
// behind if the page changes under it.
//
// It is only ever decoration. The cart is updated before the flight starts,
// so a browser that will not animate — or a page with no cart on screen —
// loses nothing at all.
//
// Where it lands is whatever carries `data-cart-target` and is currently
// visible: the header's basket on a desktop, the tab bar's on a phone, the
// staff shop's own panel on /staff. An attribute rather than a ref because
// the thing being added and the thing it lands in are usually in different
// trees, and threading a ref between them would mean a context for a
// decoration.

/** Mark an element as somewhere a flight can land. */
export const CART_TARGET_ATTR = "data-cart-target";

/**
 * The picture on the card the button belongs to.
 *
 * Found by walking up until an ancestor contains one, rather than by naming
 * a wrapper: the shop's card is a div, the staff shop's is an article, and
 * a selector that knows about either is a selector that silently stops
 * working the day somebody changes the other. Six levels is well past any
 * card here and short of the page.
 */
function photoNear(from: HTMLElement): HTMLImageElement | null {
  let el: HTMLElement | null = from;
  for (let depth = 0; depth < 6 && el; depth += 1) {
    const img = el.querySelector("img");
    if (img) return img as HTMLImageElement;
    el = el.parentElement;
  }
  return null;
}

export function flyToCart(from: HTMLElement | null | undefined): void {
  if (!from || typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const photo = photoNear(from);
  if (!photo) return;

  const target = [...document.querySelectorAll<HTMLElement>(`[${CART_TARGET_ATTR}]`)].find(
    (el) => el.offsetParent !== null,
  );
  if (!target) return;

  const a = photo.getBoundingClientRect();
  const b = target.getBoundingClientRect();
  if (a.width === 0 || b.width === 0) return;

  const ghost = photo.cloneNode() as HTMLImageElement;
  ghost.setAttribute("aria-hidden", "true");
  ghost.style.cssText = [
    "position:fixed",
    `left:${a.left}px`,
    `top:${a.top}px`,
    `width:${a.width}px`,
    `height:${a.height}px`,
    "object-fit:cover",
    "border-radius:14px",
    "z-index:120",
    "pointer-events:none",
    "box-shadow:0 12px 32px rgba(15,23,42,.22)",
  ].join(";");
  document.body.appendChild(ghost);

  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  const flight = ghost.animate(
    [
      { transform: "translate(0,0) scale(1)", opacity: 1 },
      // Lifted at the halfway point, so it arcs rather than sliding across
      // the page in a straight line.
      {
        transform: `translate(${dx * 0.55}px, ${dy * 0.55 - 56}px) scale(0.55)`,
        opacity: 0.95,
        offset: 0.6,
      },
      { transform: `translate(${dx}px, ${dy}px) scale(0.1)`, opacity: 0.15 },
    ],
    { duration: 620, easing: "cubic-bezier(.4,0,.2,1)" },
  );
  flight.onfinish = () => ghost.remove();
  flight.oncancel = () => ghost.remove();
}
