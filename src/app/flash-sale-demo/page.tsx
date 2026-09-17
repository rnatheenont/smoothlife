import { redirect } from "next/navigation";

// The demo moved into the admin area.
export default function FlashSaleDemoMoved() {
  redirect("/admin/flash-sale");
}
