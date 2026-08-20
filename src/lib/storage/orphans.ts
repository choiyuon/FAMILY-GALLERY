// An upload writes to the store before it writes to the database: the browser
// PUTs `original/<id>` and only then calls /upload/complete. If that second
// call never lands — a crashed tab, a 500, a closed laptop — the object stays
// in the store with nothing pointing at it, silently eating the ~1 GB
// allowance. The daily cron sweeps those.
//
// The grace period is what makes the sweep safe: anything younger might be an
// upload still in flight, so it is left alone until the next run.
export const ORPHAN_GRACE_MS = 24 * 60 * 60 * 1000;

export interface StoredBlob {
  pathname: string;
  uploadedAt: Date;
}

/**
 * Objects in the store that no media row references and that are old enough to
 * be certain they were abandoned rather than mid-upload.
 */
export function findOrphanKeys(
  blobs: readonly StoredBlob[],
  referencedKeys: ReadonlySet<string>,
  now: number = Date.now(),
  graceMs: number = ORPHAN_GRACE_MS
): string[] {
  return blobs
    .filter(
      (blob) =>
        !referencedKeys.has(blob.pathname) &&
        now - blob.uploadedAt.getTime() >= graceMs
    )
    .map((blob) => blob.pathname);
}
