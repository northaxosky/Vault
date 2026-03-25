import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isDemoMode } from "@/lib/demo";

const DEMO_LINKS = [
  { id: "demo-1", label: "Chase", url: "https://chase.com", icon: "🏦", sortOrder: 0, createdAt: new Date().toISOString() },
  { id: "demo-2", label: "Robinhood", url: "https://robinhood.com", icon: "📈", sortOrder: 1, createdAt: new Date().toISOString() },
  { id: "demo-3", label: "Mint", url: "https://mint.intuit.com", icon: "🌿", sortOrder: 2, createdAt: new Date().toISOString() },
  { id: "demo-4", label: "Credit Karma", url: "https://creditkarma.com", icon: "⭐", sortOrder: 3, createdAt: new Date().toISOString() },
];

function isValidUrl(url: string): boolean {
  return url.startsWith("http://") || url.startsWith("https://");
}

// --- GET: Fetch all quick links for the current user ---
export async function GET() {
  if (isDemoMode()) {
    return NextResponse.json({ links: DEMO_LINKS });
  }

  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const links = await prisma.quickLink.findMany({
      where: { userId: session.user.id },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json({ links });
  } catch (error) {
    console.error("Error fetching quick links:", error);
    return NextResponse.json(
      { error: "Failed to fetch quick links" },
      { status: 500 }
    );
  }
}

// --- POST: Create a new quick link ---
export async function POST(request: Request) {
  if (isDemoMode()) {
    return NextResponse.json({ link: DEMO_LINKS[0] }, { status: 201 });
  }

  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { label, url, icon, sortOrder } = body;

    if (!label || typeof label !== "string" || label.trim().length === 0) {
      return NextResponse.json(
        { error: "Label is required" },
        { status: 400 }
      );
    }

    if (label.length > 50) {
      return NextResponse.json(
        { error: "Label must be 50 characters or less" },
        { status: 400 }
      );
    }

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "URL is required" },
        { status: 400 }
      );
    }

    if (!isValidUrl(url)) {
      return NextResponse.json(
        { error: "URL must start with http:// or https://" },
        { status: 400 }
      );
    }

    if (icon !== undefined && icon !== null && typeof icon === "string" && icon.length > 10) {
      return NextResponse.json(
        { error: "Icon must be 10 characters or less" },
        { status: 400 }
      );
    }

    const count = await prisma.quickLink.count({
      where: { userId: session.user.id },
    });

    if (count >= 20) {
      return NextResponse.json(
        { error: "Maximum of 20 quick links allowed" },
        { status: 400 }
      );
    }

    const link = await prisma.quickLink.create({
      data: {
        userId: session.user.id,
        label: label.trim(),
        url,
        icon: icon ?? null,
        sortOrder: sortOrder ?? count,
      },
    });

    return NextResponse.json({ link }, { status: 201 });
  } catch (error) {
    console.error("Error creating quick link:", error);
    return NextResponse.json(
      { error: "Failed to create quick link" },
      { status: 500 }
    );
  }
}

// --- PATCH: Update an existing quick link ---
export async function PATCH(request: Request) {
  if (isDemoMode()) {
    return NextResponse.json({ link: DEMO_LINKS[0] });
  }

  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, label, url, icon, sortOrder } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Quick link ID is required" },
        { status: 400 }
      );
    }

    const existing = await prisma.quickLink.findUnique({ where: { id } });
    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Quick link not found" },
        { status: 404 }
      );
    }

    if (label !== undefined) {
      if (typeof label !== "string" || label.trim().length === 0) {
        return NextResponse.json(
          { error: "Label is required" },
          { status: 400 }
        );
      }
      if (label.length > 50) {
        return NextResponse.json(
          { error: "Label must be 50 characters or less" },
          { status: 400 }
        );
      }
    }

    if (url !== undefined) {
      if (typeof url !== "string" || !isValidUrl(url)) {
        return NextResponse.json(
          { error: "URL must start with http:// or https://" },
          { status: 400 }
        );
      }
    }

    if (icon !== undefined && icon !== null && typeof icon === "string" && icon.length > 10) {
      return NextResponse.json(
        { error: "Icon must be 10 characters or less" },
        { status: 400 }
      );
    }

    const data: Record<string, unknown> = {};
    if (label !== undefined) data.label = label.trim();
    if (url !== undefined) data.url = url;
    if (icon !== undefined) data.icon = icon;
    if (sortOrder !== undefined) data.sortOrder = sortOrder;

    const link = await prisma.quickLink.update({
      where: { id },
      data,
    });

    return NextResponse.json({ link });
  } catch (error) {
    console.error("Error updating quick link:", error);
    return NextResponse.json(
      { error: "Failed to update quick link" },
      { status: 500 }
    );
  }
}

// --- DELETE: Remove a quick link ---
export async function DELETE(request: Request) {
  if (isDemoMode()) {
    return NextResponse.json({ success: true });
  }

  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Quick link ID is required" },
        { status: 400 }
      );
    }

    const existing = await prisma.quickLink.findUnique({ where: { id } });
    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Quick link not found" },
        { status: 404 }
      );
    }

    await prisma.quickLink.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting quick link:", error);
    return NextResponse.json(
      { error: "Failed to delete quick link" },
      { status: 500 }
    );
  }
}
