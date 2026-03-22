import type { Metadata } from "next";
import { cookies } from "next/headers";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vault",
  description: "Personal finance dashboard",
  icons: {
    icon: "/api/icon",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const theme = cookieStore.get("theme")?.value ?? "dark";

  return (
    <html
      lang="en"
      className={`${theme === "dark" ? "dark" : ""} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-mono">
        {children}
      </body>
    </html>
  );
}
