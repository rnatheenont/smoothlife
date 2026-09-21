import ChatFullscreen from "@/components/chat/ChatFullscreen";

// One person's own conversation — nothing here is the same twice, and the
// page is empty to anyone who is not its owner, so it is told not to be
// indexed rather than left to be crawled into a pile of blank results. Same
// reasoning as /account and /checkout in robots.ts.
export const metadata = {
  title: "คุยกับน้อง Smoothie | Smoothlife.com",
  robots: { index: false, follow: false },
};

export default function ChatPage() {
  return <ChatFullscreen />;
}
