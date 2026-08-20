import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import {
  shopifyAdminConfigured,
  findShopifyCustomerByEmail,
  createShopifyCustomer,
  issueGiftCard,
  sendGiftCardNotification,
  listGiftCards,
} from "@/lib/shopify-admin";

function unauthorized() {
  return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
}

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!shopifyAdminConfigured()) return NextResponse.json({ ok: false, error: "ยังไม่ได้ตั้งค่า Shopify Admin API" }, { status: 503 });
  try {
    const giftCards = await listGiftCards(20);
    return NextResponse.json({ ok: true, giftCards });
  } catch (err) {
    console.error("[admin/gift-cards] list failed", err);
    return NextResponse.json({ ok: false, error: "โหลดรายการบัตรของขวัญไม่สำเร็จ" }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!shopifyAdminConfigured()) return NextResponse.json({ ok: false, error: "ยังไม่ได้ตั้งค่า Shopify Admin API" }, { status: 503 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
  const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
  const amount = Number(body.amount);
  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : undefined;
  const expiresOn = typeof body.expiresOn === "string" && body.expiresOn ? body.expiresOn : undefined;

  if (!email || !email.includes("@")) {
    return NextResponse.json({ ok: false, error: "กรุณากรอกอีเมลลูกค้าให้ถูกต้อง" }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ ok: false, error: "กรุณาระบุมูลค่าบัตรให้ถูกต้อง" }, { status: 400 });
  }

  try {
    let customer = await findShopifyCustomerByEmail(email);
    if (!customer) {
      const created = await createShopifyCustomer({ email, firstName: firstName || undefined, lastName: lastName || undefined });
      if (!created) {
        return NextResponse.json({ ok: false, error: "ไม่พบลูกค้ารายนี้ใน Shopify และสร้างบัญชีลูกค้าใหม่ไม่สำเร็จ" }, { status: 502 });
      }
      customer = { id: created.id, firstName: firstName || null, lastName: lastName || null, phone: null, defaultAddress: null };
    }

    const giftCard = await issueGiftCard({ customerId: customer.id, amount, note, expiresOn });
    await sendGiftCardNotification(giftCard.id);

    return NextResponse.json({ ok: true, giftCard, sent: true });
  } catch (err) {
    console.error("[admin/gift-cards] issue failed", err);
    const message = err instanceof Error ? err.message : "ออกบัตรของขวัญไม่สำเร็จ";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
