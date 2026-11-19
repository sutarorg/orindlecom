/**
 * Shapes the admin console renders.
 *
 * Kept in one file so the API contract and the components cannot drift: the pages
 * import these types, the routes are annotated with them, and a change breaks the
 * build in both places at once.
 *
 * Money is always `{ minor: number; currency: string }` — never a bare number.
 * A `number` called `mrr` invites the one bug this feature cannot afford:
 * adding rupees to dollars.
 */

export type PlatformRoleWire = "owner" | "admin";

export interface Money {
  /** Integer minor units. Rupees are paise, dollars are cents. */
  minor: number;
  currency: string;
}

export interface MrrRow {
  currency: string;
  monthly: Money;
  subscribers: number;
  /** Active subscriptions whose billing period is unknown. Excluded from MRR,
   *  reported so the total is not mistaken for complete. */
  unknownPeriod: number;
}

export interface OverviewStats {
  totalUsers: number;
  verifiedUsers: number;
  paidUsers: number;
  committedBytes: number;
  reservedBytes: number;
  trashBytes: number;
  openTickets: number;
  organizations: number;
}

export interface GrowthPoint {
  day: string;
  signups: number;
  revenue: Money | null;
}

export interface ActivityItem {
  id: string;
  actorId: string | null;
  kind: string;
  /** Human-readable, derived server-side from `kind`. Never raw metadata. */
  description: string;
  createdAt: string;
}

export interface AdminUserRow {
  userId: string;
  email: string | null;
  fullName: string | null;
  createdAt: string;
  emailVerified: boolean;
  planId: string;
  subscriptionStatus: string | null;
  storageCommitted: number;
}

export interface Paged<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminUserDetail {
  userId: string;
  email: string | null;
  fullName: string | null;
  createdAt: string;
  emailVerified: boolean;
  locale: string;
  planId: string;
  subscriptionStatus: string | null;
  billingPeriod: "monthly" | "yearly" | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  storage: { committed: number; reserved: number; trash: number };
  invoices: Array<{
    id: string;
    amountMinor: number;
    currency: string;
    status: "paid" | "failed" | "refunded";
    paidAt: string | null;
    createdAt: string;
  }>;
  teams: Array<{ organizationName: string; role: string; status: string }>;
  recentActivity: ActivityItem[];
}

export interface BillingSummary {
  mrr: MrrRow[];
  statusCounts: Array<{ status: string; planId: string; currency: string; count: number }>;
  invoices: {
    paid: number;
    failed: number;
    refunded: number;
    revenue: Money[];
  };
  /**
   * How many live subscriptions each provider owns.
   *
   * Reported so an administrator can see, at a glance, how much is still on
   * the legacy provider. It is a count of arrangements, not money: money is
   * only ever reported per currency, and never summed across currencies.
   */
  providerCounts: Array<{ provider: string; subscriptions: number }>;
}

export interface StorageByPlanRow {
  planId: string;
  accounts: number;
  committedBytes: number;
  reservedBytes: number;
}

export interface LargestAccountRow {
  ownerId: string;
  email: string | null;
  planId: string;
  committedBytes: number;
  reservedBytes: number;
  trashBytes: number;
}

export interface TeamRow {
  organizationId: string;
  name: string;
  slug: string;
  ownerEmail: string | null;
  createdAt: string;
  totalMembers: number;
  activeMembers: number;
  pendingInvites: number;
}

export interface TeamMemberRow {
  id: string;
  email: string;
  role: string;
  status: string;
  joinedAt: string | null;
  createdAt: string;
}

export interface SupportTicketRow {
  id: string;
  reference: string;
  submitterName: string | null;
  submitterEmail: string;
  category: string;
  subject: string;
  ticketStatus: "open" | "in_progress" | "resolved";
  /** Delivery state of the ORIGINAL notification email — not the ticket state. */
  deliveryStatus: "pending" | "delivered" | "failed";
  assignedTo: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface SupportMessageRow {
  id: string;
  authorId: string | null;
  authorEmail: string | null;
  visibility: "public" | "internal";
  body: string;
  deliveryStatus: "pending" | "delivered" | "failed" | "not_applicable";
  deliveryError: string | null;
  createdAt: string;
}

export interface SupportTicketDetail extends SupportTicketRow {
  message: string;
  messages: SupportMessageRow[];
}

export interface AuditLogRow {
  id: string;
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface PlatformAdminRow {
  userId: string;
  email: string | null;
  role: PlatformRoleWire;
  isActive: boolean;
  createdAt: string;
  createdBy: string | null;
}

export interface IntegrationState {
  key: string;
  label: string;
  state:
    | "configured"
    | "missing"
    | "test-mode"
    | "sandbox"
    | "mismatch"
    | "not-connected";
  /** Short, safe explanation. Never a key, prefix or value. */
  detail: string;
}
