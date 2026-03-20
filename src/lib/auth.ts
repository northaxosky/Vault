import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Where to store session data. "jwt" = encrypted in a cookie
  session: {
    strategy: "jwt",
  },

  // Custom pages — tells NextAuth to use our login page instead of its default
  pages: {
    signIn: "/login",
  },

  providers: [
    // Credentials provider: email + password login
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },

      // This function runs when a user tries to log in.
      // It receives the email/password they typed and must return
      // a user object if valid, or null if invalid.
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

        // Success — return the user object. NextAuth will put this in the session.
        return {
          id: user.id,
          name: user.name,
          email: user.email,
        };
      },
    }),
  ],

  // Callbacks let you customize what gets stored in the JWT and session.
  callbacks: {
    // When a JWT is created or refreshed, attach the user's ID to it.
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },

    // When your code reads the session, make the user ID available.
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
