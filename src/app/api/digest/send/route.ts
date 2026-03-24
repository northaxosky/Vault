import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateWeeklyDigest } from "@/lib/digest";
import { sendWeeklyDigest } from "@/lib/email";

export async function POST() {
  const session = await auth();

  if (!session?.user?.id || !session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await generateWeeklyDigest(session.user.id);
    await sendWeeklyDigest(session.user.email, data);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error sending digest:", error);
    return NextResponse.json(
      { error: "Failed to send digest" },
      { status: 500 }
    );
  }
}
