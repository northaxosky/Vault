import NextAuth from "next-auth";
import authConfig from "@/lib/auth.config";

// Use the edge-safe auth config (no Prisma) for middleware.
// Route protection logic lives in the `authorized` callback in auth.config.ts.
export const { auth: middleware } = NextAuth(authConfig);

export default middleware;

// Run middleware on dashboard routes only — skip API routes, static files, etc.
export const config = {
  matcher: ["/dashboard/:path*"],
};
