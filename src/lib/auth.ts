import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import authConfig from "./auth.config";

/**
 * Full auth configuration — extends the edge-safe config with
 * Prisma-dependent logic. Used by server components and API routes.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,

  // Override providers to include the authorize() callback,
  // which needs Prisma for database lookups.
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },

      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        // Look up the user by email
        const user = await prisma.user.findUnique({
          where: { email },
        });

        // No user found, or they signed up with Google (no password)
        if (!user || !user.passwordHash) {
          return null;
        }

        // Compare the typed password against the stored hash
        const passwordMatch = await bcrypt.compare(password, user.passwordHash);

        if (!passwordMatch) {
          return null;
        }

        // Success — return the user object. NextAuth puts this in the session.
        return {
          id: user.id,
          name: user.name,
          email: user.email,
        };
      },
    }),
  ],

  callbacks: {
    ...authConfig.callbacks,

    // When your code reads the session, pull fresh user data from the DB.
    // This ensures name changes show up without needing to log out and back in.
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;

        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { name: true, email: true },
        });

        if (dbUser) {
          session.user.name = dbUser.name;
          session.user.email = dbUser.email;
        }
      }
      return session;
    },
  },
});
