/**
 * Cloudflare R2 access.
 *
 * R2 speaks the S3 API, so the AWS SDK is used against R2's endpoint. Only four
 * operations are needed — presign a PUT, presign a GET, run a multipart upload,
 * and head/delete an object — and keeping the surface that small is what makes
 * the storage rules auditable.
 *
 * Nothing here ever receives file bytes. The browser uploads directly to R2 with
 * a short-lived presigned URL; Vercel functions are small and time-limited, and
 * proxying a 5 GB upload through one is a platform limit rather than a taste
 * decision.
 */

import "server-only";

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID?.trim() ?? "";
const ACCESS_KEY = process.env.R2_ACCESS_KEY_ID?.trim() ?? "";
const SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY?.trim() ?? "";
const BUCKET = process.env.R2_BUCKET?.trim() ?? "";
const ENDPOINT =
  process.env.R2_ENDPOINT?.trim() ||
  (ACCOUNT_ID ? `https://${ACCOUNT_ID}.r2.cloudflarestorage.com` : "");
const PUBLIC_BASE = process.env.R2_PUBLIC_BASE_URL?.trim() ?? "";

export function isStorageConfigured(): boolean {
  return Boolean(ENDPOINT && ACCESS_KEY && SECRET_KEY && BUCKET);
}

let client: S3Client | null = null;

function s3(): S3Client {
  if (!isStorageConfigured()) {
    throw new Error("R2 is not configured: ACCOUNT_ID, ACCESS_KEY_ID, SECRET_ACCESS_KEY and BUCKET are required.");
  }
  client ??= new S3Client({
    region: "auto",
    endpoint: ENDPOINT,
    credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
    /*
     * Path-style URLs. This is a correctness requirement, not a preference.
     *
     * Without it the SDK signs every presigned URL against the *virtual-hosted*
     * form, `<bucket>.<account>.r2.cloudflarestorage.com`, while `ENDPOINT` (and
     * therefore the CSP's `connect-src`) names only `<account>.r2.cloudflarestorage.com`.
     * The browser then refuses the PUT as a cross-origin request to a host that is
     * not in the policy, and reports it as `xhr.onerror` with status 0 — indistinguishable
     * from a dropped connection, and fatal to every upload.
     *
     * It fails in the most confusing way possible: R2 itself is configured correctly,
     * the bucket CORS rule lists the right origin, and the presigned URL works when
     * pasted into curl, because curl enforces no CSP. Only the browser refuses it.
     *
     * R2 supports both forms, so pinning path-style keeps every object URL on the
     * single origin the deployment already knows about.
     */
    forcePathStyle: true,
    // R2 does not support the SDK's checksum-trailer behaviour, which otherwise
    // breaks presigned PUTs with an unexpected header.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return client;
}

/* ------------------------------------------------------------------ */
/*  Object keys                                                        */
/* ------------------------------------------------------------------ */

/**
 * Build a storage key.
 *
 * The key is server-generated and opaque. The customer's file name appears
 * nowhere in it. That single decision removes path traversal, unicode
 * normalisation (NFC vs NFD), emoji, RTL-override and 255-byte-key problems at
 * once, and means two files both called `invoice.pdf` cannot collide.
 *
 * The original name lives in `files.name`, for display only.
 */
export function buildStorageKey(tenant: { userId: string; organizationId?: string | null }): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const id = randomUUID();

  // An organization-scoped object lives under o/, so lifecycle rules and access
  // audits can work per tenant without reading the database.
  const prefix = tenant.organizationId ? `o/${tenant.organizationId}` : `u/${tenant.userId}`;
  return `${prefix}/${yyyy}/${mm}/${id}`;
}

/**
 * A public URL, for the ONLY prefix that has one.
 *
 * Everything else is private and reachable solely through a presigned GET.
 * A permanent public URL to a private file is exactly what the requirements
 * forbid, so this throws rather than quietly returning something.
 */
export function publicUrl(key: string): string {
  if (!key.startsWith("avatars/")) {
    throw new Error(
      `publicUrl() was asked for a private key (${key.slice(0, 8)}…). Private objects are served through presigned URLs, not public ones.`,
    );
  }
  if (!PUBLIC_BASE) {
    throw new Error("R2_PUBLIC_BASE_URL is not configured.");
  }
  return `${PUBLIC_BASE.replace(/\/$/, "")}/${key}`;
}

/* ------------------------------------------------------------------ */
/*  Presigning                                                         */
/* ------------------------------------------------------------------ */

/** Presigned PUT for a single-part upload. 15 minutes. */
export async function presignPut(key: string, contentType: string, expiresIn = 900) {
  return getSignedUrl(
    s3(),
    new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType }),
    { expiresIn },
  );
}

/**
 * Presigned GET for a download.
 *
 * Five minutes by default: long enough for a browser to start the transfer,
 * short enough that a copied URL is not a durable leak.
 */
export async function presignGet(
  key: string,
  {
    expiresIn = 300,
    filename,
    disposition = "attachment",
    contentType,
  }: {
    expiresIn?: number;
    filename?: string;
    disposition?: "attachment" | "inline";
    contentType?: string;
  } = {},
) {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ResponseContentDisposition:
      disposition === "attachment" && filename
        ? `attachment; filename="${filename.replace(/["\\]/g, "")}"`
        : disposition,
    ResponseContentType: contentType,
  });
  return getSignedUrl(s3(), command, { expiresIn });
}

/* ------------------------------------------------------------------ */
/*  Multipart                                                          */
/* ------------------------------------------------------------------ */

export async function createMultipart(key: string, contentType: string): Promise<string> {
  const result = await s3().send(
    new CreateMultipartUploadCommand({ Bucket: BUCKET, Key: key, ContentType: contentType }),
  );
  if (!result.UploadId) throw new Error("R2 did not return a multipart upload id.");
  return result.UploadId;
}

/** Presign one part. Part numbers are 1-based, as R2/S3 require. */
export async function presignPart(
  key: string,
  uploadId: string,
  partNumber: number,
  expiresIn = 900,
) {
  return getSignedUrl(
    s3(),
    new UploadPartCommand({
      Bucket: BUCKET,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
    }),
    { expiresIn },
  );
}

export async function completeMultipart(
  key: string,
  uploadId: string,
  parts: { partNumber: number; etag: string }[],
) {
  return s3().send(
    new CompleteMultipartUploadCommand({
      Bucket: BUCKET,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        // R2 requires ascending part order and will reject otherwise.
        Parts: [...parts]
          .sort((a, b) => a.partNumber - b.partNumber)
          .map((p) => ({ PartNumber: p.partNumber, ETag: p.etag })),
      },
    }),
  );
}

export async function abortMultipart(key: string, uploadId: string) {
  await s3().send(
    new AbortMultipartUploadCommand({ Bucket: BUCKET, Key: key, UploadId: uploadId }),
  );
}

/* ------------------------------------------------------------------ */
/*  Object inspection                                                  */
/* ------------------------------------------------------------------ */

/**
 * What actually arrived.
 *
 * Returns null when the object does not exist, rather than throwing: "the upload
 * isn't there" is an expected outcome that the caller must handle, not an
 * exceptional one.
 */
export async function headObject(key: string): Promise<{ size: number; contentType?: string } | null> {
  try {
    const result = await s3().send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return { size: Number(result.ContentLength ?? 0), contentType: result.ContentType };
  } catch (error) {
    const name = (error as { name?: string }).name;
    if (name === "NotFound" || name === "NoSuchKey") return null;
    throw error;
  }
}

export async function deleteObject(key: string) {
  await s3().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

/** List one page of objects, for reconciliation. */
export async function listObjects(prefix: string, continuationToken?: string) {
  const result = await s3().send(
    new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: prefix,
      ContinuationToken: continuationToken,
      MaxKeys: 1000,
    }),
  );
  return {
    objects: (result.Contents ?? []).map((o) => ({ key: o.Key ?? "", size: Number(o.Size ?? 0) })),
    nextToken: result.NextContinuationToken,
  };
}
