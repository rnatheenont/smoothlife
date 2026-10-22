import { supabaseRest } from "@/lib/supabase-server";

// Calling the staff sale's RPCs. Server only — see the note in ./staff-sale
// on why the types live apart from this.

export type RpcResult = {
  ok: boolean;
  reason?: string;
  detail?: Record<string, unknown>;
} & Record<string, unknown>;

export function staffRpc<T = RpcResult>(fn: string, args: Record<string, unknown>) {
  return supabaseRest<T>(`rpc/${fn}`, { method: "POST", body: JSON.stringify(args) });
}
