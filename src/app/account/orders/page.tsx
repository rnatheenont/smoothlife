"use client";

import AccountLayout from "@/components/account/AccountLayout";
import OrdersList from "@/components/account/OrdersList";

export default function OrdersPage() {
  return (
    <AccountLayout>
      <OrdersList />
    </AccountLayout>
  );
}
