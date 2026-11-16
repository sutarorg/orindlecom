/**
 * GET /api/storage — the six figures the storage page shows.
 *
 * Every number comes from the database. Nothing is derived in the client,
 * because "used" computed from a paginated item list would be a lie the moment
 * pagination kicked in.
 */

import { handle, ok, withActor } from "@/lib/api";
import { createSupabaseServerClient } from "@/lib/auth/supabase/server";
import { planById } from "@/config/pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const auth = await withActor();
    if (!auth.ok) return auth.response;

    const supabase = await createSupabaseServerClient();

    const [{ data: usage }, { data: subscription }] = await Promise.all([
      supabase
        .from("storage_usage")
        .select("committed_bytes, reserved_bytes, trash_bytes")
        .eq("owner_id", auth.actor.userId)
        .maybeSingle(),
      supabase
        .from("subscriptions")
        .select("plan_id, status")
        .eq("owner_id", auth.actor.userId)
        .in("status", ["active", "past_due"])
        .maybeSingle(),
    ]);

    const plan = planById((subscription?.plan_id ?? "free") as Parameters<typeof planById>[0]);

    const committed = Number(usage?.committed_bytes ?? 0);
    const reserved = Number(usage?.reserved_bytes ?? 0);
    const trash = Number(usage?.trash_bytes ?? 0);
    const total = plan.storageBytes;

    return ok({
      planId: plan.id,
      planName: plan.name,
      total,
      // Trash is inside committed: the bytes are still in the bucket and still
      // cost money, so subtracting them would show space the customer cannot use.
      committed,
      reserved,
      trash,
      used: committed + reserved,
      available: Math.max(total - committed - reserved, 0),
      authoritative: true,
    });
  });
}
