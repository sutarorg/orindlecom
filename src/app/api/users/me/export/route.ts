/**
 * GET /api/users/me/export
 *
 * Self-service account data export (DPDP / GDPR portability). Returns a JSON
 * attachment containing the authenticated user's profile, storage summary,
 * folders, files metadata (never raw secrets or storage credentials), shares,
 * subscriptions, invoices, organization memberships, and recent activity.
 */

import "server-only";

import { NextResponse } from "next/server";
import { enforceRateLimit, handle, withActor } from "@/lib/api";
import { LIMITS, userBucket } from "@/lib/rate-limit";
import { createSupabaseServerClient } from "@/lib/auth/supabase/server";
import { sendEmail } from "@/lib/resend/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const auth = await withActor();
    if (!auth.ok) return auth.response;

    const limited = await enforceRateLimit(
      userBucket("account.export", auth.actor.userId),
      LIMITS.adminExport,
    );
    if (limited) return limited;

    const supabase = await createSupabaseServerClient();
    const userId = auth.actor.userId;

    const [profileRes, usageRes, foldersRes, filesRes, shareGrantsRes, shareLinksRes, subsRes, invoicesRes, membersRes, activityRes] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, preferred_currency, created_at, updated_at, deletion_requested_at")
          .eq("id", userId)
          .maybeSingle(),
        supabase
          .from("storage_usage")
          .select("committed_bytes, reserved_bytes, trash_bytes, updated_at")
          .eq("owner_id", userId)
          .maybeSingle(),
        supabase
          .from("folders")
          .select("id, name, parent_id, organization_id, created_at, updated_at, deleted_at")
          .eq("owner_id", userId)
          .order("created_at", { ascending: true }),
        supabase
          .from("files")
          .select("id, name, folder_id, organization_id, size_bytes, mime_type, category, starred, status, created_at, updated_at, deleted_at")
          .eq("owner_id", userId)
          .order("created_at", { ascending: true }),
        supabase
          .from("share_grants")
          .select("id, file_id, folder_id, grantee_id, permission, expires_at, created_at")
          .eq("granted_by", userId)
          .order("created_at", { ascending: true }),
        supabase
          .from("share_links")
          .select("id, file_id, folder_id, permission, expires_at, revoked_at, created_at")
          .eq("created_by", userId)
          .order("created_at", { ascending: true }),
        supabase
          .from("subscriptions")
          .select("id, plan_id, currency, billing_period, status, current_period_start, current_period_end, cancel_at_period_end, created_at")
          .eq("owner_id", userId)
          .order("created_at", { ascending: false }),
        supabase
          .from("invoices")
          .select("id, provider_payment_id, amount_minor, currency, status, paid_at, created_at")
          .eq("owner_id", userId)
          .order("created_at", { ascending: false }),
        supabase
          .from("members")
          .select("organization_id, role, status, joined_at, created_at")
          .eq("user_id", userId),
        supabase
          .from("activity_events")
          .select("id, kind, subject_type, subject_id, metadata, created_at")
          .eq("actor_id", userId)
          .order("created_at", { ascending: false })
          .limit(200),
      ]);

    const payload = {
      exportedAt: new Date().toISOString(),
      service: "Orindle",
      account: {
        id: userId,
        email: auth.actor.email,
        profile: profileRes.data ?? null,
      },
      storage: usageRes.data ?? null,
      folders: foldersRes.data ?? [],
      files: filesRes.data ?? [],
      shareGrants: shareGrantsRes.data ?? [],
      shareLinks: shareLinksRes.data ?? [],
      subscriptions: subsRes.data ?? [],
      invoices: invoicesRes.data ?? [],
      organizations: membersRes.data ?? [],
      recentActivity: activityRes.data ?? [],
    };

    await supabase.from("activity_events").insert({
      actor_id: userId,
      subject_type: "user",
      subject_id: userId,
      kind: "account.exported",
      metadata: {
        fileCount: payload.files.length,
        folderCount: payload.folders.length,
      },
    });

    await sendEmail({
      to: auth.actor.email,
      template: "data-export-ready",
      data: {
        name: auth.actor.fullName || "there",
      },
    }).catch(() => {});

    const dateStamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="orindle-data-export-${dateStamp}.json"`,
        "Cache-Control": "no-store",
      },
    });
  });
}
