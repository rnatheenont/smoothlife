import AccountLayout from "@/components/account/AccountLayout";
import LoginChannels from "@/components/account/LoginChannels";

// Still its own page: a Google or LINE sign-in leaves the site and comes
// back to wherever it started, and the account-merge decision it can raise
// is parked in a cookie for the next render of this component to show. The
// same component is also reachable from the account settings page.
export default function VerifyPage() {
  return (
    <AccountLayout>
      <LoginChannels />
    </AccountLayout>
  );
}
