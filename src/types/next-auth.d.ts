import { DefaultSession } from "next-auth";

// Extend NextAuth's built-in types to include our custom fields.
// Without this, TypeScript won't let us access session.user.id
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}
