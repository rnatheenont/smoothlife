import { redirect } from "next/navigation";

// Moved into the knowledge base as a tab — reading what the assistant
// answered and fixing the article behind it were never two errands. A link
// somebody saved still lands on it.
export default function AiLogPage() {
  redirect("/admin/knowledge-base");
}
