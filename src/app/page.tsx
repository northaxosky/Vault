import { redirect } from "next/navigation";

export default function Home() {
  // Send anyone who hits the root URL to the dashboard.
  // The dashboard page handles auth — if they're not logged in,
  // it redirects them to /login.
  redirect("/dashboard");
}
