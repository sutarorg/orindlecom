/**
 * POST /api/uploads/prepare — steps 1–7 of the upload flow.
 *
 * Step 1 (authenticate) is `withActor`. Step 2 (authorise) and 3 (validate) run
 * inside the service. Steps 5–7 (reserve, session, presign) are the service's job.
 */

import { handle, ok, readJson, requireNumber, requireString, requireUuid, withActor } from "@/lib/api";
import { validateItemName } from "@/lib/api";
import { prepareUpload } from "@/domain/storage/upload-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handle(async () => {
    // Step 1: identity, from the verified session only.
    const auth = await withActor();
    if (!auth.ok) return auth.response;

    const body = await readJson(request);

    const result = await prepareUpload(auth.actor, {
      name: validateItemName(requireString(body, "name", { max: 255 })),
      size: requireNumber(body, "size", { min: 1 }),
      mimeType: requireString(body, "mimeType", { max: 255 }),
      parentId: requireUuid(body, "parentId", true),
      checksumSha256:
        typeof body.checksumSha256 === "string" && /^[a-f0-9]{64}$/i.test(body.checksumSha256)
          ? body.checksumSha256.toLowerCase()
          : null,
    });

    return ok(result);
  });
}
