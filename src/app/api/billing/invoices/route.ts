/**
 * GET /api/billing/invoices
 *
 * Returns the authenticated user's payment receipts from `public.invoices`,
 * scoped to the caller via RLS.
 */

import "server-only";

import { handle, ok, withActor } from "@/lib/api";
import { createSupabaseServerClient } from "@/lib/auth/supabase/server";
import { AppError } from "@/domain/auth/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const auth = await withActor();
    if (!auth.ok) return auth.response;

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("invoices")
      .select("id, subscription_id, provider_payment_id, amount_minor, currency, status, paid_at, created_at")
      .eq("owner_id", auth.actor.userId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      throw new AppError("unknown", "We couldn't load your payment history.");
    }

    const invoices = (data ?? []).map((row) => ({
      id: String(row.id),
      subscriptionId: row.subscription_id ? String(row.subscription_id) : null,
      paymentId: String(row.provider_payment_id),
      amountMinor: Number(row.amount_minor ?? 0),
      currency: String(row.currency ?? "INR"),
      status: String(row.status),
      paidAt: row.paid_at ? String(row.paid_at) : null,
      createdAt: String(row.created_at),
    }));

    return ok({ invoices });
  });
}
