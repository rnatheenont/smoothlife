import { redirect } from "next/navigation";

// Moved into the knowledge base, where it belongs: the base is what the
// assistant can answer, and these are the questions customers are nudged
// towards asking. A link somebody saved still lands on it.
export default function ChatSuggestionsPage() {
  redirect("/admin/knowledge-base");
}
