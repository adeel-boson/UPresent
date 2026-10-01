import { beforeEach, describe, expect, it, vi } from "vitest";

const { testDb } = await vi.hoisted(async () => {
  const { createTestDatabase } = await import("@/lib/db/testing");
  return { testDb: await createTestDatabase() };
});

vi.mock("@/lib/db/client", () => ({ db: testDb }));
vi.mock("@/lib/db/tenant", async (importOriginal) => {
  const tenant = await importOriginal<typeof TenantModule>();
  const { createTestWithTenant } = await import("@/lib/db/testing");
  return { ...tenant, withTenant: createTestWithTenant(testDb, tenant.createWithTenant) };
});

import {
  acceptHostInvitation,
  InvalidHostInvitationTokenError,
} from "@/lib/auth/accept-host-invitation";
import { authenticateUser } from "@/lib/auth/authenticate";
import type * as TenantModule from "@/lib/db/tenant";
import { resetTestDatabase } from "@/lib/db/testing";
import { createGroup } from "@/lib/groups/create";
import { HOST_INVITATION_TOKEN_TTL_MS, inviteHost } from "@/lib/groups/invite-host";
import { listGroupsForUser } from "@/lib/groups/list";
import {
  readToken,
  recordingSender,
  seedOrganizations,
  springfieldAdmin,
} from "@/lib/groups/test-fixtures";

const INVITEE = "lisa.teacher@springfield.example";
const PASSWORD = "chalk and slate 9";

describe("acceptHostInvitation", () => {
  let groupId: string;

  beforeEach(async () => {
    vi.stubEnv("APP_URL", "https://upresent.example");
    vi.useRealTimers();
    await resetTestDatabase(testDb);
    await seedOrganizations(testDb);
    ({ id: groupId } = await createGroup({
      actor: springfieldAdmin,
      name: "Grade 2 — Room 7",
      sessionCreationMode: "MANUAL",
    }));
  });

  async function invite(): Promise<string> {
    const sender = recordingSender();
    await inviteHost({ actor: springfieldAdmin, groupId, email: INVITEE }, sender);
    return readToken(sender.sent[0]);
  }

  it("lets the host log in with the password they set, and see the Group they were invited to", async () => {
    const token = await invite();

    await acceptHostInvitation({ token, password: PASSWORD });

    const host = await authenticateUser({ email: INVITEE, password: PASSWORD });
    expect(host).toMatchObject({ email: INVITEE, role: "HOST" });
    await expect(listGroupsForUser({ id: host?.id ?? "" })).resolves.toEqual([
      { id: groupId, name: "Grade 2 — Room 7", sessionCreationMode: "MANUAL" },
    ]);
  });

  it("doesn't let an invited host log in before they accept", async () => {
    await invite();

    await expect(authenticateUser({ email: INVITEE, password: "" })).resolves.toBeNull();
    await expect(authenticateUser({ email: INVITEE, password: PASSWORD })).resolves.toBeNull();
  });

  it("works only once", async () => {
    const token = await invite();
    await acceptHostInvitation({ token, password: PASSWORD });

    await expect(acceptHostInvitation({ token, password: "taken over 123" })).rejects.toThrow(
      InvalidHostInvitationTokenError,
    );
    await expect(authenticateUser({ email: INVITEE, password: PASSWORD })).resolves.not.toBeNull();
  });

  it("refuses an expired invitation", async () => {
    const token = await invite();
    vi.useFakeTimers({ now: Date.now() + HOST_INVITATION_TOKEN_TTL_MS + 1, toFake: ["Date"] });

    await expect(acceptHostInvitation({ token, password: PASSWORD })).rejects.toThrow(
      InvalidHostInvitationTokenError,
    );
    vi.useRealTimers();
    await expect(authenticateUser({ email: INVITEE, password: PASSWORD })).resolves.toBeNull();
  });

  it("refuses an unknown token", async () => {
    await expect(
      acceptHostInvitation({ token: "not-a-real-token", password: PASSWORD }),
    ).rejects.toThrow(InvalidHostInvitationTokenError);
  });
});
