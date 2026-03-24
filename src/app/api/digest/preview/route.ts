import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateWeeklyDigest } from "@/lib/digest";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await generateWeeklyDigest(session.user.id);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error generating digest preview:", error);
    return NextResponse.json(
      { error: "Failed to generate digest" },
      { status: 500 }
    );
  }
}
