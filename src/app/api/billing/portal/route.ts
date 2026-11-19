/**
 * POST /api/billing/portal
 *
 * Opens Dodo's Customer Portal for the authenticated user.
 *
 * The customer id is resolved from `public.billing_customers`, which is
 * written only by the server. A customer id in the request body is ignored
 * entirely — accepting one would let anyone open another customer's portal.
 *
 * The portal is where a customer views provider invoices and updates their
 * payment method. It is deliberately not where they change their plan: a plan
 * change moves Orindle's storage allowance, so it stays under the control of
 * Orindle's own authenticated API, which enforces the end-of-period policy.
 */

import "server-only";

import { enforceRateLimit, handle, ok, withActor } from "@/lib/api";
import { LIMITS, userBucket } from "@/lib/rate-limit";
import { AppError } from "@/domain/auth/errors";
import { createPortalSession, isBillingConfigured } from "@/domain/billing/dodo";
import { findProviderCustomer } from "@/domain/billing/checkout-session";
import { SITE } from "@/config/site";

export const runtime = "nodejs";

export async function POST() {
  return handle(async () => {
    const auth = await withActor();
    if (!auth.ok) return auth.response;

    if (!isBillingConfigured()) {
      throw new AppError(
        "not_configured",
        "Payments aren't connected on this deployment yet.",
      );
    }

    const limited = await enforceRateLimit(
      userBucket("billing.portal", auth.actor.userId),
      LIMITS.checkout,
    );
    if (limited) return limited;

    // Server-side lookup. The client never names a provider customer.
    const customer = await findProviderCustomer(auth.actor.userId);

    if (!customer) {
      throw new AppError(
        "not_found",
        "There's no billing account to manage yet. It appears here after your first payment.",
      );
    }

    const url = await createPortalSession(
      customer.customerId,
      `${SITE.url}/dashboard/billing`,
    );

    return ok({ url });
  });
}
