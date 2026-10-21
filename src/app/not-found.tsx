import { PAGES_WAVE1_ENABLED } from "@/lib/feature-flags";
import { SystemPageBodyFromCode } from "@/lib/pages/system-page";
import SmoothieRig from "@/components/mascot/SmoothieRig";
import { Button } from "@/components/ui";

function NotFoundWritten() {
  return (
    <div className="container-page py-24 text-center">
      <SmoothieRig className="mx-auto aspect-[1100/1180] w-36" greet="curious" idleActions={["think", "shake", "curious"]} />
      <h1 className="text-4xl font-bold brand-text-gradient mt-4 mb-3">404</h1>
      <p className="text-slate-500 mb-6">ไม่พบหน้าที่คุณต้องการ</p>
      <Button size="lg" href="/">
        กลับหน้าแรก
      </Button>
    </div>
  );
}

/** From the document when wave 1 is on. The fallback is not optional here:
 *  a not-found page that answers "not found" is a loop, and this is also the
 *  page that gets shown when the database is the thing that is broken. */
export default function NotFound() {
  if (PAGES_WAVE1_ENABLED) return <SystemPageBodyFromCode pageKey="not-found" fallback={<NotFoundWritten />} />;
  return <NotFoundWritten />;
}
