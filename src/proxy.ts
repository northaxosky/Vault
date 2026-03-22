import NextAuth from "next-auth";
import authConfig from "@/lib/auth.config";

// Use the edge-safe auth config (no Prisma) for the proxy.
// Route protection logic lives in the `authorized` callback in auth.config.ts.
export const { auth: proxy } = NextAuth(authConfig);

export default proxy;

// Run proxy on dashboard routes only — skip API routes, static files, etc.
export const config = {
  matcher: ["/dashboard/:path*"],
};
