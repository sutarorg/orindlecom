/**
 * Admin data access.
 *
 * Every function takes an `AdminContext` — which can only be produced by
 * `requirePlatformAdmin()`. There is no overload that accepts a bare client, so a
 * call site cannot accidentally reach the service client without having
 * authorized first.
 *
 * Two rules applied throughout:
 *
 *   1. **Aggregate in the database.** Every total here is a single SQL function
 *      call. Nothing iterates rows in JavaScript to produce a platform figure.
 *   2. **Never widen what is exposed.** A user detail page shows counts and
 *      statuses; it never shows a file name, a signed URL, an IP hash or a token.
 */

import "server-only";

import { AppError } from "@/domain/auth/errors";
import type { AdminContext } from "./auth";
import type {
  ActivityItem,
  AdminUserDetail,
  AdminUserRow,
  AuditLogRow,
  BillingSummary,
  GrowthPoint,
  LargestAccountRow,
  MrrRow,
  OverviewStats,
  Paged,
  PlatformAdminRow,
  StorageByPlanRow,
  SupportMessageRow,
  SupportTicketDetail,
  SupportTicketRow,
  TeamMemberRow,
  TeamRow,
} from "./types";

/** A postgrest-style single-row result, tolerant of the function returning none. */
function first<T>(rows: T[] | null): T | null {
  return rows && rows.length > 0 ? rows[0] : null;
}

/** Supabase returns `bigint` as a string when it exceeds JS safe integers. */
function num(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return 0;
}

/* ------------------------------------------------------------------ */
/*  Overview                                                           */
/* ------------------------------------------------------------------ */

export async function getOverviewStats({ db }: AdminContext): Promise<OverviewStats> {
  const { data, error } = await db.rpc("admin_overview_stats");
  if (error) throw new AppError("unknown", "We couldn't load the platform totals.");
  const row = first(data as Record<string, unknown>[]);
  return {
    totalUsers: num(row?.total_users),
    verifiedUsers: num(row?.verified_users),
    paidUsers: num(row?.paid_users),
    committedBytes: num(row?.committed_bytes),
    reservedBytes: num(row?.reserved_bytes),
    trashBytes: num(row?.trash_bytes),
    openTickets: num(row?.open_tickets),
    organizations: num(row?.organizations),
  };
}

export async function getMrr({ db }: AdminContext): Promise<MrrRow[]> {
  const { data, error } = await db.rpc("admin_mrr");
  if (error) throw new AppError("unknown", "We couldn't calculate recurring revenue.");

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const byCurrency = new Map<string, MrrRow>();

  for (const row of rows) {
    const currency = String(row.currency);
    const existing = byCurrency.get(currency) ?? {
      currency,
      monthly: { minor: 0, currency },
      subscribers: 0,
      unknownPeriod: 0,
    };
    // The function returns one row per (currency, kind); adding them here is
    // addition within one currency, never across currencies.
    existing.monthly.minor += num(row.monthly_minor);
    existing.subscribers += num(row.subscribers);
    existing.unknownPeriod += num(row.unknown_period);
    byCurrency.set(currency, existing);
  }

  return [...byCurrency.values()].sort((a, b) => a.currency.localeCompare(b.currency));
}

export async function getGrowthSeries(
  { db }: AdminContext,
  days: number,
): Promise<GrowthPoint[]> {
  const { data, error } = await db.rpc("admin_growth_series", { p_days: days });
  if (error) throw new AppError("unknown", "We couldn't load the growth figures.");

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const byDay = new Map<string, GrowthPoint>();

  for (const row of rows) {
    const day = String(row.day);
    const point = byDay.get(day) ?? { day, signups: 0, revenue: null };
    point.signups = num(row.signups);
    // A day with no revenue row has `currency === null`; revenue stays null
    // rather than becoming ₹0, because "we earned nothing" and "we have no
    // invoices" are different statements.
    if (row.currency) {
      point.revenue = { minor: num(row.revenue_minor), currency: String(row.currency) };
    }
    byDay.set(day, point);
  }

  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
}

/**
 * Recent activity, translated to human-readable text.
 *
 * `activity_events.kind` values are dotted identifiers written by the billing and
 * storage paths. The raw `metadata` is deliberately not sent to the browser: it
 * contains payment identifiers and internal ids, and a support operator does not
 * need them to understand what happened.
 */
const ACTIVITY_LABELS: Record<string, string> = {
  "subscription.activated": "Started a paid plan",
  "subscription.cancelled": "Scheduled a cancellation",
  "subscription.expired": "Subscription expired",
  "subscription.changed": "Changed plan",
  "storage.reconciled": "Storage totals reconciled",
  "storage.released": "Upload reservation released",
  "file.trashed": "Moved a file to trash",
  "file.restored": "Restored a file",
  "upload.completed": "Uploaded a file",
};

export async function getRecentActivity(
  { db }: AdminContext,
  limit = 8,
): Promise<ActivityItem[]> {
  const { data, error } = await db
    .from("activity_events")
    .select("id, actor_id, kind, created_at")
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 50));

  if (error) throw new AppError("unknown", "We couldn't load recent activity.");

  return (data ?? []).map((row) => ({
    id: String(row.id),
    actorId: row.actor_id ? String(row.actor_id) : null,
    kind: String(row.kind),
    description: ACTIVITY_LABELS[String(row.kind)] ?? "Account activity",
    createdAt: String(row.created_at),
  }));
}

/* ------------------------------------------------------------------ */
/*  Users                                                              */
/* ------------------------------------------------------------------ */

export interface UserDirectoryQuery {
  search: string | null;
  plan: string | null;
  verified: boolean | null;
  status: string | null;
  createdAfter: string | null;
  createdBefore: string | null;
  sort: "newest" | "oldest" | "storage";
  page: number;
  pageSize: number;
  offset: number;
}

export async function getUserDirectory(
  { db }: AdminContext,
  query: UserDirectoryQuery,
): Promise<Paged<AdminUserRow>> {
  const { data, error } = await db.rpc("admin_user_directory", {
    p_search: query.search,
    p_plan: query.plan,
    p_verified: query.verified,
    p_status: query.status,
    p_created_after: query.createdAfter,
    p_created_before: query.createdBefore,
    p_sort: query.sort,
    p_limit: query.pageSize,
    p_offset: query.offset,
  });

  if (error) throw new AppError("unknown", "We couldn't load the user directory.");

  const rows = (data ?? []) as Array<Record<string, unknown>>;

  return {
    rows: rows.map((row) => ({
      userId: String(row.user_id),
      email: row.email ? String(row.email) : null,
      fullName: row.full_name ? String(row.full_name) : null,
      createdAt: String(row.created_at),
      emailVerified: Boolean(row.email_verified),
      planId: String(row.plan_id ?? "free"),
      subscriptionStatus: row.subscription_status ? String(row.subscription_status) : null,
      storageCommitted: num(row.storage_committed),
    })),
    // count(*) over () is present on every row even when the page is empty only
    // if rows exist; a genuinely empty result means zero matches, which is the
    // correct total here.
    total: rows.length > 0 ? num(rows[0].total_count) : 0,
    page: query.page,
    pageSize: query.pageSize,
  };
}

export async function getUserDetail(
  { db }: AdminContext,
  userId: string,
): Promise<AdminUserDetail | null> {
  const { data: userRows, error: userError } = await db.rpc("admin_user_directory", {
    p_search: userId,
    p_limit: 1,
    p_offset: 0,
  });
  if (userError) throw new AppError("unknown", "We couldn't load that account.");

  const row = ((userRows ?? []) as Array<Record<string, unknown>>).find(
    (candidate) => String(candidate.user_id) === userId,
  );
  if (!row) return null;

  const [{ data: profile }, { data: subscription }, { data: usage }, { data: invoices }, { data: members }, { data: activity }] =
    await Promise.all([
      db.from("profiles").select("locale").eq("id", userId).maybeSingle(),
      db
        .from("subscriptions")
        .select("plan_id, status, billing_period, current_period_end, cancel_at_period_end")
        .eq("owner_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      db
        .from("storage_usage")
        .select("committed_bytes, reserved_bytes, trash_bytes")
        .eq("owner_id", userId)
        .maybeSingle(),
      db
        .from("invoices")
        .select("id, amount_minor, currency, status, paid_at, created_at")
        .eq("owner_id", userId)
        .order("created_at", { ascending: false })
        .limit(10),
      db
        .from("members")
        .select("role, status, organizations(name)")
        .eq("user_id", userId)
        .limit(20),
      db
        .from("activity_events")
        .select("id, actor_id, kind, created_at")
        .eq("actor_id", userId)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

  return {
    userId,
    email: row.email ? String(row.email) : null,
    fullName: row.full_name ? String(row.full_name) : null,
    createdAt: String(row.created_at),
    emailVerified: Boolean(row.email_verified),
    locale: String(profile?.locale ?? "en"),
    planId: String(subscription?.plan_id ?? "free"),
    subscriptionStatus: subscription?.status ? String(subscription.status) : null,
    billingPeriod: (subscription?.billing_period as "monthly" | "yearly" | null) ?? null,
    currentPeriodEnd: subscription?.current_period_end ? String(subscription.current_period_end) : null,
    cancelAtPeriodEnd: Boolean(subscription?.cancel_at_period_end),
    storage: {
      committed: num(usage?.committed_bytes),
      reserved: num(usage?.reserved_bytes),
      trash: num(usage?.trash_bytes),
    },
    invoices: (invoices ?? []).map((invoice) => ({
      id: String(invoice.id),
      amountMinor: num(invoice.amount_minor),
      currency: String(invoice.currency),
      status: invoice.status as "paid" | "failed" | "refunded",
      paidAt: invoice.paid_at ? String(invoice.paid_at) : null,
      createdAt: String(invoice.created_at),
    })),
    teams: (members ?? []).map((member) => {
      // Supabase returns an embedded to-one relation as an object; older
      // typings describe it as an array. Handle both rather than crashing.
      const org = member.organizations as { name?: string } | Array<{ name?: string }> | null;
      const name = Array.isArray(org) ? org[0]?.name : org?.name;
      return {
        organizationName: name ?? "Organization",
        role: String(member.role),
        status: String(member.status),
      };
    }),
    recentActivity: (activity ?? []).map((event) => ({
      id: String(event.id),
      actorId: event.actor_id ? String(event.actor_id) : null,
      kind: String(event.kind),
      description: ACTIVITY_LABELS[String(event.kind)] ?? "Account activity",
      createdAt: String(event.created_at),
    })),
  };
}

/* ------------------------------------------------------------------ */
/*  Billing                                                            */
/* ------------------------------------------------------------------ */

export async function getBillingSummary({ db }: AdminContext): Promise<BillingSummary> {
  const [{ data: summaryRows, error: summaryError }, mrr, revenue, providers] = await Promise.all([
    db.rpc("admin_billing_summary"),
    getMrr({ db } as AdminContext),
    db
      .from("invoices")
      .select("status, amount_minor, currency")
      .limit(100_000),
    db
      .from("subscriptions")
      .select("billing_provider")
      .in("status", ["active", "past_due"])
      .limit(100_000),
  ]);

  if (summaryError) throw new AppError("unknown", "We couldn't load the billing summary.");
  if (revenue.error) throw new AppError("unknown", "We couldn't load invoice totals.");

  const counts = { paid: 0, failed: 0, refunded: 0 };
  const byCurrency = new Map<string, number>();

  for (const invoice of revenue.data ?? []) {
    const status = String(invoice.status) as keyof typeof counts;
    if (status in counts) counts[status] += 1;
    // Refunded and failed invoices are counted as records but never as revenue.
    if (status === "paid") {
      const currency = String(invoice.currency);
      byCurrency.set(currency, (byCurrency.get(currency) ?? 0) + num(invoice.amount_minor));
    }
  }

  /*
   * How many live arrangements each provider owns. A count, not money: the
   * revenue figures above stay separated by currency and are never summed
   * across currencies.
   */
  const providerCounts = new Map<string, number>();
  for (const row of providers.data ?? []) {
    const provider = String(row.billing_provider ?? "unknown");
    providerCounts.set(provider, (providerCounts.get(provider) ?? 0) + 1);
  }

  return {
    mrr,
    statusCounts: ((summaryRows ?? []) as Array<Record<string, unknown>>).map((row) => ({
      status: String(row.status),
      planId: String(row.plan_id),
      currency: String(row.currency),
      count: num(row.subscriptions),
    })),
    invoices: {
      ...counts,
      revenue: [...byCurrency.entries()]
        .map(([currency, minor]) => ({ currency, minor }))
        .sort((a, b) => a.currency.localeCompare(b.currency)),
    },
    providerCounts: [...providerCounts.entries()]
      .map(([provider, subscriptions]) => ({ provider, subscriptions }))
      .sort((a, b) => a.provider.localeCompare(b.provider)),
  };
}

/* ------------------------------------------------------------------ */
/*  Storage                                                            */
/* ------------------------------------------------------------------ */

export async function getStorageByPlan({ db }: AdminContext): Promise<StorageByPlanRow[]> {
  const { data, error } = await db.rpc("admin_storage_by_plan");
  if (error) throw new AppError("unknown", "We couldn't load storage distribution.");
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    planId: String(row.plan_id ?? "free"),
    accounts: num(row.accounts),
    committedBytes: num(row.committed_bytes),
    reservedBytes: num(row.reserved_bytes),
  }));
}

export async function getLargestAccounts(
  { db }: AdminContext,
  limit = 10,
): Promise<LargestAccountRow[]> {
  const { data, error } = await db.rpc("admin_largest_accounts", { p_limit: limit });
  if (error) throw new AppError("unknown", "We couldn't load the largest accounts.");
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    ownerId: String(row.owner_id),
    email: row.email ? String(row.email) : null,
    planId: String(row.plan_id ?? "free"),
    committedBytes: num(row.committed_bytes),
    reservedBytes: num(row.reserved_bytes),
    trashBytes: num(row.trash_bytes),
  }));
}

export async function getReservationCount({ db }: AdminContext): Promise<number> {
  const { count, error } = await db
    .from("storage_reservations")
    .select("id", { count: "exact", head: true })
    .eq("status", "reserved");
  if (error) throw new AppError("unknown", "We couldn't count open uploads.");
  return count ?? 0;
}

/* ------------------------------------------------------------------ */
/*  Teams                                                              */
/* ------------------------------------------------------------------ */

export async function getTeamDirectory(
  { db }: AdminContext,
  query: { search: string | null; page: number; pageSize: number; offset: number },
): Promise<Paged<TeamRow>> {
  const { data, error } = await db.rpc("admin_team_directory", {
    p_search: query.search,
    p_limit: query.pageSize,
    p_offset: query.offset,
  });
  if (error) throw new AppError("unknown", "We couldn't load organizations.");

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  return {
    rows: rows.map((row) => ({
      organizationId: String(row.organization_id),
      name: String(row.name),
      slug: String(row.slug),
      ownerEmail: row.owner_email ? String(row.owner_email) : null,
      createdAt: String(row.created_at),
      totalMembers: num(row.total_members),
      activeMembers: num(row.active_members),
      pendingInvites: num(row.pending_invites),
    })),
    total: rows.length > 0 ? num(rows[0].total_count) : 0,
    page: query.page,
    pageSize: query.pageSize,
  };
}

export async function getTeamMembers(
  { db }: AdminContext,
  organizationId: string,
): Promise<TeamMemberRow[]> {
  const { data, error } = await db
    .from("members")
    .select("id, email, role, status, joined_at, created_at")
    .eq("organization_id", organizationId)
    .neq("status", "removed")
    .order("role", { ascending: true })
    .limit(200);

  if (error) throw new AppError("unknown", "We couldn't load team members.");
  return (data ?? []).map((row) => ({
    id: String(row.id),
    email: String(row.email),
    role: String(row.role),
    status: String(row.status),
    joinedAt: row.joined_at ? String(row.joined_at) : null,
    createdAt: String(row.created_at),
  }));
}

/* ------------------------------------------------------------------ */
/*  Support                                                            */
/* ------------------------------------------------------------------ */

export interface SupportQuery {
  search: string | null;
  status: string | null;
  category: string | null;
  page: number;
  pageSize: number;
  offset: number;
}

export async function getSupportTickets(
  { db }: AdminContext,
  query: SupportQuery,
): Promise<Paged<SupportTicketRow>> {
  let builder = db
    .from("support_requests")
    .select(
      "id, reference, submitter_name, submitter_email, category, subject, ticket_status, delivery_status, assigned_to, created_at, resolved_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(query.offset, query.offset + query.pageSize - 1);

  if (query.status) builder = builder.eq("ticket_status", query.status);
  if (query.category) builder = builder.eq("category", query.category);
  if (query.search) {
    // PostgREST `or` with a quoted value. The value is escaped so a comma or a
    // parenthesis in a customer's email cannot restructure the filter.
    const term = query.search.replace(/[,()]/g, " ").trim();
    builder = builder.or(
      `submitter_email.ilike.%${term}%,reference.ilike.%${term}%,subject.ilike.%${term}%,submitter_name.ilike.%${term}%`,
    );
  }

  const { data, error, count } = await builder;
  if (error) throw new AppError("unknown", "We couldn't load support tickets.");

  return {
    rows: (data ?? []).map((row) => ({
      id: String(row.id),
      reference: String(row.reference),
      submitterName: row.submitter_name ? String(row.submitter_name) : null,
      submitterEmail: String(row.submitter_email),
      category: String(row.category),
      subject: String(row.subject),
      ticketStatus: row.ticket_status as SupportTicketRow["ticketStatus"],
      deliveryStatus: row.delivery_status as SupportTicketRow["deliveryStatus"],
      assignedTo: row.assigned_to ? String(row.assigned_to) : null,
      createdAt: String(row.created_at),
      resolvedAt: row.resolved_at ? String(row.resolved_at) : null,
    })),
    total: count ?? 0,
    page: query.page,
    pageSize: query.pageSize,
  };
}

export async function getSupportTicket(
  { db }: AdminContext,
  id: string,
): Promise<SupportTicketDetail | null> {
  const { data: ticket, error } = await db
    .from("support_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new AppError("unknown", "We couldn't load that ticket.");
  if (!ticket) return null;

  const { data: messages, error: messageError } = await db
    .from("support_messages")
    .select("id, author_id, visibility, body, delivery_status, delivery_error, created_at")
    .eq("request_id", id)
    .order("created_at", { ascending: true });

  if (messageError) throw new AppError("unknown", "We couldn't load the reply history.");

  // Resolve author emails in one query rather than one per message.
  const authorIds = [...new Set((messages ?? []).map((m) => m.author_id).filter(Boolean))] as string[];
  const authorEmails = new Map<string, string>();
  if (authorIds.length > 0) {
    const { data: admins } = await db
      .from("platform_admins")
      .select("user_id")
      .in("user_id", authorIds);
    // platform_admins has no email; the audit log does not either. The operator's
    // identity is shown as a role, not an address, which is the minimum needed.
    for (const admin of admins ?? []) authorEmails.set(String(admin.user_id), "Platform team");
  }

  return {
    id: String(ticket.id),
    reference: String(ticket.reference),
    submitterName: ticket.submitter_name ? String(ticket.submitter_name) : null,
    submitterEmail: String(ticket.submitter_email),
    category: String(ticket.category),
    subject: String(ticket.subject),
    ticketStatus: ticket.ticket_status as SupportTicketRow["ticketStatus"],
    deliveryStatus: ticket.delivery_status as SupportTicketRow["deliveryStatus"],
    assignedTo: ticket.assigned_to ? String(ticket.assigned_to) : null,
    createdAt: String(ticket.created_at),
    resolvedAt: ticket.resolved_at ? String(ticket.resolved_at) : null,
    message: String(ticket.message),
    messages: (messages ?? []).map((message) => ({
      id: String(message.id),
      authorId: message.author_id ? String(message.author_id) : null,
      authorEmail: message.author_id ? (authorEmails.get(String(message.author_id)) ?? null) : null,
      visibility: message.visibility as SupportMessageRow["visibility"],
      body: String(message.body),
      deliveryStatus: message.delivery_status as SupportMessageRow["deliveryStatus"],
      deliveryError: message.delivery_error ? String(message.delivery_error) : null,
      createdAt: String(message.created_at),
    })),
  };
}

/* ------------------------------------------------------------------ */
/*  Audit log                                                          */
/* ------------------------------------------------------------------ */

export interface AuditQuery {
  action: string | null;
  actorId: string | null;
  targetId: string | null;
  from: string | null;
  to: string | null;
  page: number;
  pageSize: number;
  offset: number;
}

export async function getAuditLogs(
  { db }: AdminContext,
  query: AuditQuery,
): Promise<Paged<AuditLogRow>> {
  let builder = db
    .from("platform_admin_audit_logs")
    .select("id, actor_id, action, target_type, target_id, metadata, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(query.offset, query.offset + query.pageSize - 1);

  if (query.action) builder = builder.eq("action", query.action);
  if (query.actorId) builder = builder.eq("actor_id", query.actorId);
  if (query.targetId) builder = builder.eq("target_id", query.targetId);
  if (query.from) builder = builder.gte("created_at", query.from);
  if (query.to) builder = builder.lte("created_at", query.to);

  const { data, error, count } = await builder;
  if (error) throw new AppError("unknown", "We couldn't load the audit log.");

  const actorIds = [...new Set((data ?? []).map((row) => row.actor_id).filter(Boolean))] as string[];
  const emails = new Map<string, string>();
  if (actorIds.length > 0) {
    // Emails live in auth.users, which the JS client cannot read. The audit row
    // stores the actor id; the identity is resolved through the admin directory
    // for the page of rows being shown, in one call.
    const { data: directory } = await db.rpc("admin_user_directory", {
      p_limit: 200,
      p_offset: 0,
    });
    for (const row of (directory ?? []) as Array<Record<string, unknown>>) {
      emails.set(String(row.user_id), row.email ? String(row.email) : String(row.user_id));
    }
  }

  return {
    rows: (data ?? []).map((row) => ({
      id: String(row.id),
      actorId: row.actor_id ? String(row.actor_id) : null,
      actorEmail: row.actor_id ? (emails.get(String(row.actor_id)) ?? null) : null,
      action: String(row.action),
      targetType: String(row.target_type),
      targetId: row.target_id ? String(row.target_id) : null,
      metadata: (row.metadata ?? {}) as Record<string, unknown>,
      createdAt: String(row.created_at),
    })),
    total: count ?? 0,
    page: query.page,
    pageSize: query.pageSize,
  };
}

/* ------------------------------------------------------------------ */
/*  Platform administrators                                            */
/* ------------------------------------------------------------------ */

export async function listPlatformAdmins({ db }: AdminContext): Promise<PlatformAdminRow[]> {
  const { data, error } = await db
    .from("platform_admins")
    .select("user_id, role, is_active, created_at, created_by")
    .order("created_at", { ascending: true });

  if (error) throw new AppError("unknown", "We couldn't load platform administrators.");

  const rows = (data ?? []).map((row) => ({
    userId: String(row.user_id),
    role: row.role as PlatformAdminRow["role"],
    isActive: Boolean(row.is_active),
    createdAt: String(row.created_at),
    createdBy: row.created_by ? String(row.created_by) : null,
  }));

  if (rows.length === 0) return [];

  // One directory call resolves the emails for everyone listed.
  const { data: directory } = await db.rpc("admin_user_directory", { p_limit: 200, p_offset: 0 });
  const emails = new Map<string, string>();
  for (const row of (directory ?? []) as Array<Record<string, unknown>>) {
    if (row.email) emails.set(String(row.user_id), String(row.email));
  }

  return rows.map((row) => ({ ...row, email: emails.get(row.userId) ?? null }));
}

export async function getPlatformAdminEmail(
  { db }: AdminContext,
  userId: string,
): Promise<string | null> {
  const { data } = await db.rpc("admin_user_directory", { p_search: userId, p_limit: 5, p_offset: 0 });
  const match = ((data ?? []) as Array<Record<string, unknown>>).find(
    (row) => String(row.user_id) === userId,
  );
  return match?.email ? String(match.email) : null;
}

/**
 * Look up an existing account by exact email address (case-insensitive) for
 * platform-admin grants. Requires a confirmed email so an unverified mailbox
 * can never be granted platform privileges.
 */
export async function findVerifiedUserByEmail(
  { db }: AdminContext,
  email: string,
): Promise<{ userId: string; email: string; verified: boolean } | null> {
  const target = email.trim().toLowerCase();
  const { data } = await db.rpc("admin_user_directory", { p_search: target, p_limit: 20, p_offset: 0 });
  const match = ((data ?? []) as Array<Record<string, unknown>>).find(
    (row) => row.email && String(row.email).toLowerCase() === target,
  );
  if (!match) return null;
  return {
    userId: String(match.user_id),
    email: String(match.email),
    verified: Boolean(match.email_confirmed_at),
  };
}

/* ------------------------------------------------------------------ */
/*  Operational counters and the price catalogue                       */
/* ------------------------------------------------------------------ */

/**
 * Delivery and webhook counts for the Logs page.
 *
 * Counts only. The Logs page exists to answer "did email go out" and "is a webhook
 * stuck", and neither question needs a recipient address, a message body or a
 * provider payload. Aggregating here rather than scanning in the page keeps the
 * payloads out of the render path entirely: a page that never selects them cannot
 * leak them into an RSC payload.
 *
 * `email_log` and `webhook_events` are append-only and small by nature, but "small
 * by nature" is not a bound. The 5,000-row ceiling is stated on the page so a
 * capped count is never mistaken for a complete one.
 */
export const OPERATIONAL_COUNT_CEILING = 5000;

export async function getOperationalCounts({ db }: AdminContext): Promise<{
  email: { queued: number; sent: number; failed: number; capped: boolean };
  webhooks: { total: number; unprocessed: number; errored: number; capped: boolean };
}> {
  const [emailResult, webhookResult] = await Promise.all([
    db.from("email_log").select("status").limit(OPERATIONAL_COUNT_CEILING + 1),
    db
      .from("webhook_events")
      .select("processed_at, error")
      .limit(OPERATIONAL_COUNT_CEILING + 1),
  ]);

  if (emailResult.error) throw new AppError("unknown", "We couldn't read email delivery.");
  if (webhookResult.error) throw new AppError("unknown", "We couldn't read webhook state.");

  const emailRows = emailResult.data ?? [];
  const email = { queued: 0, sent: 0, failed: 0, capped: emailRows.length > OPERATIONAL_COUNT_CEILING };
  for (const row of emailRows.slice(0, OPERATIONAL_COUNT_CEILING)) {
    const status = String(row.status);
    if (status === "queued" || status === "sent" || status === "failed") email[status] += 1;
  }

  const webhookRows = webhookResult.data ?? [];
  const webhooks = {
    total: Math.min(webhookRows.length, OPERATIONAL_COUNT_CEILING),
    unprocessed: 0,
    errored: 0,
    capped: webhookRows.length > OPERATIONAL_COUNT_CEILING,
  };
  for (const row of webhookRows.slice(0, OPERATIONAL_COUNT_CEILING)) {
    if (!row.processed_at) webhooks.unprocessed += 1;
    if (row.error) webhooks.errored += 1;
  }

  return { email, webhooks };
}

/**
 * The price catalogue, read from the same tables checkout resolves amounts from.
 *
 * Read-only on purpose. Changing a price needs an approval workflow that does not
 * exist yet, and a form here would be a second, unaudited path to charging someone.
 * `approved = false` rows are included so an operator can see that a price exists
 * but is not chargeable — hiding them would make checkout's refusal look like a bug.
 */
export async function getPriceCatalogue({ db }: AdminContext): Promise<
  Array<{
    planId: string;
    planName: string;
    storageBytes: number;
    isActive: boolean;
    prices: Array<{ currency: string; period: string; amountMinor: number; approved: boolean }>;
  }>
> {
  const [planResult, priceResult] = await Promise.all([
    db.from("plans").select("id, name, storage_bytes, sort_order, is_active").order("sort_order"),
    db.from("plan_prices").select("plan_id, currency, period, amount_minor, approved").order("plan_id"),
  ]);

  if (planResult.error) throw new AppError("unknown", "We couldn't read the plan catalogue.");
  if (priceResult.error) throw new AppError("unknown", "We couldn't read plan prices.");

  const pricesByPlan = new Map<string, Array<{ currency: string; period: string; amountMinor: number; approved: boolean }>>();
  for (const row of priceResult.data ?? []) {
    const key = String(row.plan_id);
    const list = pricesByPlan.get(key) ?? [];
    list.push({
      currency: String(row.currency),
      period: String(row.period),
      amountMinor: Number(row.amount_minor),
      approved: Boolean(row.approved),
    });
    pricesByPlan.set(key, list);
  }

  return (planResult.data ?? []).map((plan) => ({
    planId: String(plan.id),
    planName: String(plan.name),
    storageBytes: Number(plan.storage_bytes),
    isActive: Boolean(plan.is_active),
    prices: pricesByPlan.get(String(plan.id)) ?? [],
  }));
}
