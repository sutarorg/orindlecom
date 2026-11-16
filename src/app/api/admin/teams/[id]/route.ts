/**
 * GET /api/admin/teams/:id — one organization's members.
 *
 * Member emails are shown because an operator handling a support case needs to
 * know who is in the team. Nothing else about those people is exposed: no ids
 * beyond the membership row, no storage, no billing.
 */

import { AppError } from "@/domain/auth/errors";
import { adminOk, adminRoute } from "@/lib/admin/route-helpers";
import { getTeamMembers } from "@/lib/admin/service";
import { uuidParam } from "@/lib/admin/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return adminRoute(
    async (ctx) => {
      const { id } = await context.params;
      const organizationId = uuidParam(id, "organization");

      const { data: org, error } = await ctx.db
        .from("organizations")
        .select("id, name, slug, created_at")
        .eq("id", organizationId)
        .maybeSingle();

      if (error) throw new AppError("unknown", "We couldn't load that organization.");
      if (!org) throw new AppError("not_found", "That organization doesn't exist.");

      return adminOk({
        organization: {
          id: String(org.id),
          name: String(org.name),
          slug: String(org.slug),
          createdAt: String(org.created_at),
        },
        members: await getTeamMembers(ctx, organizationId),
      });
    },
    { permission: "view_operations", limit: "adminRead" },
  );
}
