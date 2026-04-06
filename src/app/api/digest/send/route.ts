import { auth } from "@/lib/auth";
import { generateWeeklyDigest } from "@/lib/digest";
import { sendWeeklyDigest } from "@/lib/email";
import { unauthorizedResponse, errorResponse, successResponse } from "@/lib/api-response";

export async function POST() {
  const session = await auth();

  if (!session?.user?.id || !session?.user?.email) {
    return unauthorizedResponse();
  }

  try {
    const data = await generateWeeklyDigest(session.user.id);
    await sendWeeklyDigest(session.user.email, data);
    return successResponse({ success: true });
  } catch (error) {
    console.error("Error sending digest:", error);
    return errorResponse("Failed to send digest", 500);
  }
}
