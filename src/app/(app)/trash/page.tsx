import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { listTrash, TRASH_RETENTION_MS } from "@/lib/media/trash";
import { presignGet } from "@/lib/storage/blob";
import { RestoreButton } from "@/components/trash/restore-button";
import { EmptyTrashButton } from "@/components/trash/empty-trash-button";

function daysLeft(deletedAt: Date): number {
  const remaining = deletedAt.getTime() + TRASH_RETENTION_MS - Date.now();
  return Math.max(0, Math.ceil(remaining / (24 * 60 * 60 * 1000)));
}

export default async function TrashPage() {
  const session = await auth();
  // Members cannot reach the trash at all (spec §2).
  if (session?.user.role !== "admin") redirect("/gallery");

  const rows = await listTrash();
  const items = await Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      title: row.title,
      kind: row.kind,
      thumbUrl: await presignGet(row.blobThumbKey),
      left: daysLeft(row.deletedAt!),
    }))
  );

  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto">
      <header className="flex items-center justify-between mb-2">
        <h1 className="text-3xl">휴지통</h1>
        <Link href="/gallery" className="text-[var(--color-ink-muted)] font-serif">
          갤러리로
        </Link>
      </header>
      <p className="text-sm text-[var(--color-ink-muted)] mb-8">
        삭제한 사진은 30일 동안 여기 머물다가 자동으로 지워집니다.
      </p>

      {items.length === 0 ? (
        <p className="text-[var(--color-ink-muted)]">휴지통이 비어 있습니다.</p>
      ) : (
        <>
          <ul className="flex flex-col gap-3 mb-10">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-4 border border-[var(--color-border)] rounded-lg p-3"
              >
                <Image
                  src={item.thumbUrl}
                  alt={item.title}
                  width={64}
                  height={64}
                  className="w-16 h-16 object-cover rounded bg-[var(--color-bg-elevated)]"
                  unoptimized
                />
                <div className="flex-1 min-w-0">
                  <p className="font-serif text-[var(--color-ink)] truncate">{item.title}</p>
                  <p className="text-xs text-[var(--color-ink-muted)]">
                    {item.kind === "video" ? "영상" : "사진"} · {item.left}일 뒤 자동 삭제
                  </p>
                </div>
                <RestoreButton id={item.id} title={item.title} />
              </li>
            ))}
          </ul>
          <EmptyTrashButton count={items.length} />
        </>
      )}
    </main>
  );
}
