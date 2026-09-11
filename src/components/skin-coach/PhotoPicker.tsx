"use client";

import { useRef } from "react";
import { resizeForUpload, type ResizedImage } from "@/lib/image-utils";

/**
 * Two hidden file inputs behind one hook: the front camera (phones open it
 * straight away) and the photo library, for anyone who'd rather pick a
 * picture they already took. Desktop browsers ignore `capture` and show a
 * file dialog for both.
 */
export function usePhotoPicker(onPicked: (image: ResizedImage) => void, onError: (message: string) => void) {
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const libraryRef = useRef<HTMLInputElement | null>(null);

  async function handle(file: File | undefined) {
    if (!file) return;
    try {
      onPicked(await resizeForUpload(file));
    } catch {
      onError("อ่านรูปนี้ไม่ได้ ลองถ่ายหรือเลือกรูปใหม่อีกครั้ง");
    }
  }

  const inputs = (
    <>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={(e) => {
          handle(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={libraryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          handle(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </>
  );

  return {
    inputs,
    openCamera: () => cameraRef.current?.click(),
    openLibrary: () => libraryRef.current?.click(),
  };
}
