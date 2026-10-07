/**
 * Where the home page's hero band leaves a photo for /chat to pick up.
 *
 * The question itself travels in the URL, but a photo cannot — so the band
 * shrinks it to the same ~1024px the chat would have sent anyway, parks the
 * data URL here, and adds ?photo=1. /chat takes it on its first render and
 * clears the slot: sessionStorage so it dies with the tab, and removed on
 * read so a reload does not re-attach a picture nobody asked for twice.
 *
 * It is handed to the chat's own handleImagePick rather than sent, which is
 * what keeps the consent prompt in the one place that knows whether consent
 * has already been given.
 */
export const HERO_PHOTO_KEY = "sl_hero_photo";
