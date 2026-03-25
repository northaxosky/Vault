import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";

/**
 * Edge-safe auth configuration.
 *
 * This file must NOT import Prisma or any Node.js-only modules because
 * it is used by the middleware, which runs in the Edge Runtime.
 *
 * The authorize() callback lives in auth.ts (server-side only) because
 * it needs Prisma. The middleware only verifies an existing JWT.
 */
export default {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
    }),
  ],
  callbacks: {
    // After sign-in, redirect to /dashboard instead of back to /login
    redirect({ url, baseUrl }) {
      // Relative paths
      if (url.startsWith("/")) {
        // Don't redirect back to login after successful auth
        if (url === "/login" || url.startsWith("/login?")) {
          return `${baseUrl}/dashboard`;
        }
        return `${baseUrl}${url}`;
      }
      // Same-origin absolute URLs
      if (new URL(url).origin === baseUrl) {
        const path = new URL(url).pathname;
        if (path === "/login") return `${baseUrl}/dashboard`;
        return url;
      }
      return `${baseUrl}/dashboard`;
    },

    // Attach user ID to the JWT
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },

    // The authorized callback is what middleware uses to guard routes.
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = nextUrl.pathname.startsWith("/dashboard");

      if (process.env.DEMO_MODE === "true") return true;

      if (isOnDashboard && !isLoggedIn) {
        return false; // Redirects to pages.signIn (/login)
      }

      return true;
    },
  },
} satisfies NextAuthConfig;
