import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { verifyPassword } from "./password";
import { writeAudit } from "@/lib/audit/log";
import { authConfigBase } from "./base";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfigBase,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "").trim().toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        const db = await getDb();
        const [user] = await db.select().from(users).where(eq(users.email, email));
        if (!user) return null;

        const ok = await verifyPassword(password, user.passwordHash);
        if (!ok) return null;

        await writeAudit({ actorId: user.id, action: "login", metadata: { email } });

        return {
          id: user.id,
          email: user.email,
          role: user.role,
          displayName: user.displayName,
        };
      },
    }),
  ],
});
