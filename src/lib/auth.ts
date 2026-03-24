import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import authConfig from "./auth.config";
import { isDemoMode } from "./demo";
import { getDemoSession } from "./demo-auth";

const nextAuth = NextAuth({
  ...authConfig,

  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
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

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user || !user.passwordHash) {
          return null;
        }

        const passwordMatch = await bcrypt.compare(password, user.passwordHash);

        if (!passwordMatch) {
          return null;
        }

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

    async signIn({ user, account }) {
      if (account?.provider !== "google") return true;

      const email = user.email;
      if (!email) return false;

      // Check if this Google account is already linked
      const existingOAuth = await prisma.oAuthAccount.findUnique({
        where: {
          provider_providerAccountId: {
            provider: account.provider,
            providerAccountId: account.providerAccountId,
          },
        },
        include: { user: true },
      });

      if (existingOAuth) {
        // Returning user — update tokens
        await prisma.oAuthAccount.update({
          where: { id: existingOAuth.id },
          data: {
            accessToken: account.access_token ?? null,
            refreshToken: account.refresh_token ?? null,
            expiresAt: account.expires_at ?? null,
            idToken: account.id_token ?? null,
          },
        });
        user.id = existingOAuth.user.id;
        return true;
      }

      // Check if a user with this email already exists (account linking)
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        // Link Google to the existing credentials-based user
        await prisma.oAuthAccount.create({
          data: {
            userId: existingUser.id,
            provider: account.provider,
            providerAccountId: account.providerAccountId,
            type: account.type ?? "oidc",
            accessToken: account.access_token ?? null,
            refreshToken: account.refresh_token ?? null,
            expiresAt: account.expires_at ?? null,
            tokenType: account.token_type ?? null,
            scope: account.scope ?? null,
            idToken: account.id_token ?? null,
          },
        });
        // Google verifies emails, so mark as verified
        if (!existingUser.emailVerified) {
          await prisma.user.update({
            where: { id: existingUser.id },
            data: { emailVerified: new Date() },
          });
        }
        user.id = existingUser.id;
        return true;
      }

      // Brand new Google user — create User + OAuthAccount
      const newUser = await prisma.user.create({
        data: {
          email,
          name: user.name ?? null,
          emailVerified: new Date(),
          oauthAccounts: {
            create: {
              provider: account.provider,
              providerAccountId: account.providerAccountId,
              type: account.type ?? "oidc",
              accessToken: account.access_token ?? null,
              refreshToken: account.refresh_token ?? null,
              expiresAt: account.expires_at ?? null,
              tokenType: account.token_type ?? null,
              scope: account.scope ?? null,
              idToken: account.id_token ?? null,
            },
          },
        },
      });
      user.id = newUser.id;
      return true;
    },

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

export const { handlers, signIn, signOut } = nextAuth;

const _auth = nextAuth.auth;

export async function auth() {
  if (isDemoMode()) return getDemoSession();
  return _auth();
}
