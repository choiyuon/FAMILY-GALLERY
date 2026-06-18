import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { media } from "@/lib/db/schema";

export async function isTitleTaken(title: string): Promise<boolean> {
  const db = await getDb();
  const [row] = await db
    .select({ id: media.id })
    .from(media)
    .where(eq(media.titleLower, title.toLowerCase()))
    .limit(1);
  return Boolean(row);
}

export async function suggestTitles(base: string): Promise<string[]> {
  if (!(await isTitleTaken(base))) return [];

  const suggestions: string[] = [];
  let n = 1;
  while (suggestions.length < 3) {
    const candidate = `${base} (${n})`;
    if (!(await isTitleTaken(candidate))) {
      suggestions.push(candidate);
    }
    n++;
    if (n > 1000) break;
  }
  return suggestions;
}
