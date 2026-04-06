import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateWeeklyDigest } from "@/lib/digest";
import { unauthorizedResponse, errorResponse } from "@/lib/api-response";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return unauthorizedResponse();
  }

  try {
    const data = await generateWeeklyDigest(session.user.id);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error generating digest preview:", error);
    return errorResponse("Failed to generate digest", 500);
  }
}
