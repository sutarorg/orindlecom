/**
 * Business workspace permission invariants.
 *
 * Ensures server-side role enforcement in `src/domain/business/permissions.ts`
 * matches the shared UI role rules in `src/lib/business/roles.ts` across every
 * role combination, and refuses self-escalation, owner invites, last-owner
 * removal, and non-owner ownership transfers.
 */
import { describe, expect, it } from "vitest";
import {
  assertCanChangeRole,
  assertCanInviteRole,
  assertCanRemoveMember,
  assertCanTransferOwnership,
  assertCapability,
} from "@/domain/business/permissions";
import { can, removalBlocker, roleChangeBlocker } from "@/lib/business/roles";
import type { BusinessRole, Capability } from "@/lib/business/types";

const ALL_ROLES: BusinessRole[] = ["owner", "admin", "member"];

const ALL_CAPABILITIES: Capability[] = [
  "members.view",
  "members.invite",
  "members.remove",
  "members.changeRole",
  "members.transferOwnership",
  "folders.create",
  "folders.delete",
  "folders.manageAccess",
  "storage.view",
  "activity.view",
  "org.edit",
  "org.delete",
  "billing.manage",
];

describe("business role capabilities", () => {
  it("matches server assertCapability against UI can() for every (role, capability)", () => {
    for (const role of ALL_ROLES) {
      for (const cap of ALL_CAPABILITIES) {
        if (can(role, cap)) {
          expect(() => assertCapability(role, cap)).not.toThrow();
        } else {
          expect(() => assertCapability(role, cap)).toThrow();
        }
      }
    }
  });
});

describe("invitations", () => {
  it("allows owner and admin to invite admin or member, never owner", () => {
    expect(() => assertCanInviteRole("owner", "admin")).not.toThrow();
    expect(() => assertCanInviteRole("owner", "member")).not.toThrow();
    expect(() => assertCanInviteRole("admin", "admin")).not.toThrow();
    expect(() => assertCanInviteRole("admin", "member")).not.toThrow();

    expect(() => assertCanInviteRole("owner", "owner")).toThrow();
    expect(() => assertCanInviteRole("admin", "owner")).toThrow();
    expect(() => assertCanInviteRole("member", "member")).toThrow();
  });
});

describe("role changes", () => {
  it("matches server assertCanChangeRole against UI roleChangeBlocker across all pairs", () => {
    for (const actorRole of ALL_ROLES) {
      for (const targetRole of ALL_ROLES) {
        for (const nextRole of ALL_ROLES) {
          for (const isSelf of [false, true]) {
            const blocker = roleChangeBlocker({ actorRole, targetRole, nextRole, isSelf });
            const allowed = can(actorRole, "members.changeRole") && !blocker;
            if (allowed) {
              expect(() =>
                assertCanChangeRole(actorRole, { role: targetRole, isViewer: isSelf }, nextRole),
              ).not.toThrow();
            } else {
              expect(() =>
                assertCanChangeRole(actorRole, { role: targetRole, isViewer: isSelf }, nextRole),
              ).toThrow();
            }
          }
        }
      }
    }
  });
});

describe("member removal", () => {
  it("matches server assertCanRemoveMember against UI removalBlocker and protects the last owner", () => {
    for (const actorRole of ALL_ROLES) {
      for (const targetRole of ALL_ROLES) {
        for (const isSelf of [false, true]) {
          for (const isLastOwner of [false, true]) {
            const blocker = removalBlocker({ actorRole, targetRole, isSelf, isLastOwner });
            const allowed = can(actorRole, "members.remove") && !blocker;
            if (allowed) {
              expect(() =>
                assertCanRemoveMember(actorRole, {
                  role: targetRole,
                  isViewer: isSelf,
                  isLastOwner,
                }),
              ).not.toThrow();
            } else {
              expect(() =>
                assertCanRemoveMember(actorRole, {
                  role: targetRole,
                  isViewer: isSelf,
                  isLastOwner,
                }),
              ).toThrow();
            }
          }
        }
      }
    }
  });
});

describe("ownership transfer", () => {
  it("only allows the owner to transfer to an active non-self member", () => {
    expect(() =>
      assertCanTransferOwnership("owner", {
        status: "active",
        isViewer: false,
        userId: "user-2",
      }),
    ).not.toThrow();

    expect(() =>
      assertCanTransferOwnership("admin", {
        status: "active",
        isViewer: false,
        userId: "user-2",
      }),
    ).toThrow();

    expect(() =>
      assertCanTransferOwnership("owner", {
        status: "active",
        isViewer: true,
        userId: "user-1",
      }),
    ).toThrow();

    expect(() =>
      assertCanTransferOwnership("owner", {
        status: "invited",
        isViewer: false,
        userId: null,
      }),
    ).toThrow();
  });
});
