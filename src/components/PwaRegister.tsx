"use client";

import { useEffect } from "react";

// Turns the site into something a phone can keep.
//
// Registered after load rather than during it: the worker's own fetch costs
// bandwidth the first paint wants more, and nothing on the page depends on it
// being there. Production only — in development a cached bundle is a bug that
// takes an hour to work out.
export default function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        // Not being installable is not a broken shop.
        console.warn("[pwa] service worker did not register", err);
      });
    };

    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
