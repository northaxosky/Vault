import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import authConfig from "./auth.config";
import { isDemoMode } from "./demo";
import { getDemoSession } from "./demo-auth";
import { encrypt } from "./encryption";

function encryptToken(value: string | null | undefined): string | null {
  return value ? encrypt(value) : null;
}

let _nextAuth: ReturnType<typeof NextAuth> | null = null;

function getNextAuth() {
  if (!_nextAuth) {
    _nextAuth = NextAuth({
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
            await prisma.oAuthAccount.update({
              where: { id: existingOAuth.id },
              data: {
                accessToken: encryptToken(account.access_token),
                refreshToken: encryptToken(account.refresh_token),
                expiresAt: account.expires_at ?? null,
                idToken: encryptToken(account.id_token),
              },
            });
            user.id = existingOAuth.user.id;
            return true;
          }

          const existingUser = await prisma.user.findUnique({
            where: { email },
          });

          if (existingUser) {
            await prisma.oAuthAccount.create({
              data: {
                userId: existingUser.id,
                provider: account.provider,
                providerAccountId: account.providerAccountId,
                type: account.type ?? "oidc",
                accessToken: encryptToken(account.access_token),
                refreshToken: encryptToken(account.refresh_token),
                expiresAt: account.expires_at ?? null,
                tokenType: account.token_type ?? null,
                scope: account.scope ?? null,
                idToken: encryptToken(account.id_token),
              },
            });
            if (!existingUser.emailVerified) {
              await prisma.user.update({
                where: { id: existingUser.id },
                data: { emailVerified: new Date() },
              });
            }
            user.id = existingUser.id;
            return true;
          }

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
                  accessToken: encryptToken(account.access_token),
                  refreshToken: encryptToken(account.refresh_token),
                  expiresAt: account.expires_at ?? null,
                  tokenType: account.token_type ?? null,
                  scope: account.scope ?? null,
                  idToken: encryptToken(account.id_token),
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
            } else {
              // User was deleted — invalidate session
              session.user.id = "";
              session.user.name = null;
              session.user.email = "";
            }
          }
          return session;
        },
      },
    });
  }
  return _nextAuth;
}

export const handlers = new Proxy({} as ReturnType<typeof NextAuth>["handlers"], {
  get(_target, prop) { return Reflect.get(getNextAuth().handlers, prop); },
});
export const signIn = (...args: Parameters<ReturnType<typeof NextAuth>["signIn"]>) => getNextAuth().signIn(...args);
export const signOut = (...args: Parameters<ReturnType<typeof NextAuth>["signOut"]>) => getNextAuth().signOut(...args);

export async function auth() {
  if (isDemoMode()) return getDemoSession();
  return getNextAuth().auth();
}
