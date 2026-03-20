import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import path from "path";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const SIZE = 48;

/**
 * Convert an HSL hue (0-360) into two hex colors for a gradient.
 */
function hueToGradient(hue: number): [string, string] {
  const toHex = (h: number, s: number, l: number) => {
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color)
        .toString(16)
        .padStart(2, "0");
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  };

  return [toHex(hue, 0.8, 0.5), toHex(hue + 15, 0.75, 0.42)];
}

export async function GET() {
  let hue = 195;

  try {
    const session = await auth();
    if (session?.user?.id) {
      const settings = await prisma.userSettings.findUnique({
        where: { userId: session.user.id },
        select: { accentHue: true },
      });
      if (settings?.accentHue != null) {
        hue = settings.accentHue;
      }
    }
  } catch {
    // Not logged in — use default.
  }

  // Read the vault icon PNG from disk and convert to a data URI.
  const iconPath = path.join(process.cwd(), "public", "VaultIcon.png");
  const iconBuffer = await readFile(iconPath);
  const iconBase64 = iconBuffer.toString("base64");
  const iconSrc = `data:image/png;base64,${iconBase64}`;

  const [color1, color2] = hueToGradient(hue);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "10px",
          background: `linear-gradient(135deg, ${color1}, ${color2})`,
        }}
      >
        <img
          src={iconSrc}
          width={38}
          height={38}
        />
      </div>
    ),
    { width: SIZE, height: SIZE }
  );
}
