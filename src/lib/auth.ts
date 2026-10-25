import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

/**
 * Email/password auth via NextAuth's Credentials provider, JWT-based
 * sessions (no server-side session table). Only `id` and `role` are ever
 * carried on the session/token - everything else that matters for access
 * control (isPaid, in particular) is deliberately re-read from the
 * database on every request instead of trusted from the session, so a
 * payment or role change takes effect immediately rather than waiting for
 * the student to log out and back in (see README "Security notes").
 */
export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const normalizedEmail = String(credentials.email).toLowerCase().trim();
        const [user] = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
        if (!user) return null;

        const passwordMatches = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!passwordMatches) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id;
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
};
