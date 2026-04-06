import { NextResponse } from "next/server";

export function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export function unauthorizedResponse() {
  return errorResponse("Unauthorized", 401);
}

export function notFoundResponse(resource = "Resource") {
  return errorResponse(`${resource} not found`, 404);
}

export function validationError(message: string) {
  return errorResponse(message, 400);
}

export function successResponse(data: Record<string, unknown> = {}, status = 200) {
  return NextResponse.json(data, { status });
}
