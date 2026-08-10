"use client";

import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function firebaseConfigured() {
  return Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

export function getFirebaseAuth(): Auth {
  if (!firebaseConfigured()) {
    throw new Error("Firebase is not configured (missing NEXT_PUBLIC_FIREBASE_* env vars)");
  }
  if (!app) {
    app = getApps()[0] || initializeApp(config);
  }
  if (!auth) {
    auth = getAuth(app);
  }
  return auth;
}

// Thai mobile numbers only, for now — 08X-XXX-XXXX / 0891234567 -> +66891234567.
export function toE164Thai(localPhone: string): string {
  const digits = localPhone.replace(/\D/g, "");
  if (digits.startsWith("0")) return "+66" + digits.slice(1);
  if (digits.startsWith("66")) return "+" + digits;
  return "+66" + digits;
}
