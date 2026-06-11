import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth/password";

interface SeedInput {
  email: string;
  password: string;
  displayName: string;
}

export async function seedAdminIfMissing(input: SeedInput): Promise<void> {
  if (!input.email) throw new Error("ADMIN_EMAIL is required to seed the first admin.");
  if (!input.password) throw new Error("ADMIN_PASSWORD is required to seed the first admin.");

  const db = await getDb();
  const [existingAdmin] = await db.select().from(users).where(eq(users.role, "admin")).limit(1);
  if (existingAdmin) return;

  const passwordHash = await hashPassword(input.password);
  await db.insert(users).values({
    email: input.email.toLowerCase().trim(),
    passwordHash,
    displayName: input.displayName || "관리자",
    role: "admin",
  });
}

export async function seedFromEnv(): Promise<void> {
  await seedAdminIfMissing({
    email: process.env.ADMIN_EMAIL ?? "",
    password: process.env.ADMIN_PASSWORD ?? "",
    displayName: process.env.ADMIN_DISPLAY_NAME ?? "관리자",
  });
}
