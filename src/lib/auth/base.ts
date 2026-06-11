import type { NextAuthConfig, DefaultSession } from "next-auth";
import type {} from "next-auth/jwt";

// Module augmentation — shared session/JWT shape used by both the full config
// (route handler + server auth()) and the db-free instance used by proxy.ts.
declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: "admin" | "member";
      displayName: string;
    };
  }
  interface User {
    role: "admin" | "member";
    displayName: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: "admin" | "member";
    displayName: string;
  }
}

// Edge/db-free base config. Contains NO providers (no Credentials → no argon2,
// no db import) so proxy.ts can decode the JWT without pulling in the DB layer.
export const authConfigBase = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 }, // 30 days
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
        token.displayName = user.displayName;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      session.user.displayName = token.displayName;
      return session;
    },
  },
} satisfies NextAuthConfig;
