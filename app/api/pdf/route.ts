import type { NextRequest } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeToEmbed(raw = ""): string {
  if (!raw) return "";

  let m = raw.match(/docs\.google\.com\/document\/d\/([^/]+)/);
  if (m) {
    return `https://docs.google.com/document/d/${m[1]}/pub?embedded=true`;
  }

  m = raw.match(/docs\.google\.com\/presentation\/d\/([^/]+)/);
  if (m) {
    return `https://docs.google.com/presentation/d/${m[1]}/embed?start=false&loop=false&delayms=3000`;
  }

  m = raw.match(/docs\.google\.com\/spreadsheets\/d\/([^/]+)/);
  if (m) {
    return `https://docs.google.com/spreadsheets/d/${m[1]}/htmlview`;
  }

  m = raw.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (m) return `https://drive.google.com/file/d/${m[1]}/preview`;
  const q = raw.match(/[?&]id=([^&]+)/);
  if (q) return `https://drive.google.com/file/d/${q[1]}/preview`;

  if (/\.(docx|xlsx|pptx)(\?|$)/i.test(raw)) {
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(
      raw
    )}`;
  }

  // Nếu là PDF, dùng Google Viewer để tăng tương thích mobile (vẫn KHÔNG convert)
  if (/\.pdf(\?|$)/i.test(raw)) {
    return `https://docs.google.com/viewer?embedded=true&url=${encodeURIComponent(
      raw
    )}`;
  }

  return raw;
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url") || "";
  const mode = (req.nextUrl.searchParams.get("mode") || "").toLowerCase();
  if (!raw) return new Response("Missing url", { status: 400 });

  const embedUrl = normalizeToEmbed(raw);

  const viewerUrl = `https://docs.google.com/viewer?embedded=true&url=${encodeURIComponent(
    raw
  )}`;

  const ua = req.headers.get("user-agent") || "";
  const isMobile = /iPhone|iPad|iPod|Android/i.test(ua);
  const isInApp =
    /(FBAN|FBAV|Instagram|Messenger|Line|Zalo|TikTok|Twitter|Telegram)/i.test(
      ua
    ) ||
    (!ua.includes("Safari") && /iPhone|iPad|iPod|Android/i.test(ua));
  const target =
    mode === "embed"
      ? embedUrl
      : mode === "viewer"
      ? viewerUrl
      : isMobile || isInApp
      ? viewerUrl
      : embedUrl;

  return Response.redirect(target, 302);
}
