import { notFound } from "next/navigation";
import CustomerDetail from "./CustomerDetail";

// Admin → ลูกค้า & บัญชีผู้ใช้ → one customer.
//
// A page rather than a panel on the search screen, so the link can be pasted
// into a chat: half of support is one person asking another to look at the
// same customer, and "search for 081… and pick the second row" is not a way
// to do that. Everything it shows is loaded by the client component from
// /api/admin/customers/detail, which is where the permission checks are.

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;

export default async function AdminCustomerPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  if (!UUID.test(id)) notFound();
  return <CustomerDetail userId={id} />;
}
