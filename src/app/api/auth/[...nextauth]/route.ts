import { handlers } from "@/lib/auth";

// NextAuth needs to handle both GET and POST requests:
// GET  — serves the login page, handles OAuth callbacks
// POST — processes login form submissions
export const { GET, POST } = handlers;
