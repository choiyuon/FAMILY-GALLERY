import { del, get, issueSignedToken, list, presignUrl, put } from "@vercel/blob";
import type { IssuedSignedToken } from "@vercel/blob";
import { summarizeBlobs, type StorageSummary } from "./usage";
import type { StoredBlob } from "./orphans";

// Signed-URL lifetimes are a security ceiling from spec §13 — do not raise them.
export const UPLOAD_URL_TTL_MS = 5 * 60 * 1000;
export const VIEW_URL_TTL_MS = 24 * 60 * 60 * 1000;

// The store is private: every read and write needs a credential. On Vercel the
// SDK authenticates with OIDC (short-lived, auto-rotating); locally it falls
// back to BLOB_READ_WRITE_TOKEN written by `vercel blob create-store`.
export function isStorageConfigured(
  env: Record<string, string | undefined> = process.env
): boolean {
  return Boolean(
    env.BLOB_READ_WRITE_TOKEN || (env.VERCEL_OIDC_TOKEN && env.BLOB_STORE_ID)
  );
}

function requireStorage(): void {
  if (!isStorageConfigured()) {
    throw new Error(
      "Vercel Blob is not configured. Run `vercel blob create-store` and " +
        "`vercel env pull .env.local`, or set BLOB_READ_WRITE_TOKEN."
    );
  }
}

// issueSignedToken() hits the Blob control API, so a per-URL call would cost one
// round-trip per gallery tile. Reads are signed from one cached store-wide
// delegation instead; each URL still carries its own 24h expiry (§13).
// The delegation alone cannot sign anything — that needs clientSigningToken,
// which never leaves the server.
let readDelegation: IssuedSignedToken | null = null;

async function getReadDelegation(): Promise<IssuedSignedToken> {
  const now = Date.now();
  // Refresh while at least one full view-URL lifetime is still left, so every
  // URL we sign can carry its complete 24h TTL.
  if (readDelegation && readDelegation.validUntil > now + VIEW_URL_TTL_MS) {
    return readDelegation;
  }
  readDelegation = await issueSignedToken({
    pathname: "*",
    operations: ["get"],
    validUntil: now + 7 * 24 * 60 * 60 * 1000, // API maximum
  });
  return readDelegation;
}

/** Time-limited URL the browser can PUT one object to. */
export async function presignPut(
  pathname: string,
  contentType: string,
  maximumSizeInBytes: number
): Promise<string> {
  requireStorage();
  const validUntil = Date.now() + UPLOAD_URL_TTL_MS;
  const delegation = await issueSignedToken({
    pathname,
    operations: ["put"],
    allowedContentTypes: [contentType],
    maximumSizeInBytes,
    validUntil,
  });
  const { presignedUrl } = await presignUrl(delegation, {
    operation: "put",
    pathname,
    access: "private",
    allowedContentTypes: [contentType],
    maximumSizeInBytes,
    addRandomSuffix: false,
    // spec §3.1: an original is never overwritten. The store enforces it.
    allowOverwrite: false,
    validUntil,
  });
  return presignedUrl;
}

/** Time-limited URL the browser can GET one object from. */
export async function presignGet(pathname: string): Promise<string> {
  if (!isStorageConfigured()) {
    // Dev fallback so the gallery still renders without a Blob store.
    const seed = pathname.replace(/[^a-zA-Z0-9]/g, "-");
    return `https://picsum.photos/seed/${seed}/800/600`;
  }
  const delegation = await getReadDelegation();
  const { presignedUrl } = await presignUrl(delegation, {
    operation: "get",
    pathname,
    access: "private",
    validUntil: Date.now() + VIEW_URL_TTL_MS,
  });
  return presignedUrl;
}

async function openObject(pathname: string) {
  requireStorage();
  const result = await get(pathname, { access: "private" });
  if (!result || result.statusCode !== 200) {
    throw new Error(`Blob not found: ${pathname}`);
  }
  return result;
}

export async function getObjectBuffer(pathname: string): Promise<Buffer> {
  const { stream } = await openObject(pathname);
  return Buffer.from(await new Response(stream).arrayBuffer());
}

/**
 * Read only the first bytes of an object. Used to sniff magic bytes on videos
 * without pulling a 100 MB file into the function.
 */
export async function getObjectPrefix(
  pathname: string,
  byteCount: number
): Promise<Buffer> {
  const { stream } = await openObject(pathname);
  const reader = stream.getReader();
  const chunks: Buffer[] = [];
  let read = 0;
  try {
    while (read < byteCount) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(Buffer.from(value));
      read += value.length;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return Buffer.concat(chunks).subarray(0, byteCount);
}

export async function putObject(
  pathname: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  requireStorage();
  await put(pathname, body, {
    access: "private",
    contentType,
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

export async function deleteObject(pathname: string): Promise<void> {
  requireStorage();
  await del(pathname);
}

/**
 * Walk the whole store and total it up. One `list()` call per 1000 objects
 * (an Advanced Operation), so keep this on the admin page rather than any
 * hot path.
 */
export async function getStorageUsage(): Promise<StorageSummary> {
  requireStorage();
  const blobs: { pathname: string; size: number }[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ cursor, limit: 1000 });
    blobs.push(...page.blobs.map((b) => ({ pathname: b.pathname, size: b.size })));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return summarizeBlobs(blobs);
}

/** Every object in the store, with the timestamps the orphan sweep needs. */
export async function listObjects(): Promise<StoredBlob[]> {
  requireStorage();
  const objects: StoredBlob[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ cursor, limit: 1000 });
    objects.push(
      ...page.blobs.map((b) => ({ pathname: b.pathname, uploadedAt: b.uploadedAt }))
    );
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return objects;
}
