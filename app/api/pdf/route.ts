// app/api/pdf-open/route.ts
import type { NextRequest } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function addEmbeddedParam(u: string) {
  // thêm embedded=true nếu chưa có
  if (/[\?&]embedded=true/i.test(u)) return u;
  return u.includes("?") ? `${u}&embedded=true` : `${u}?embedded=true`;
}

/** Trả về URL NHÚNG (KHÔNG convert PDF) cho nhiều loại nguồn phổ biến */
function normalizeToEmbed(raw = ""): string {
  if (!raw) return "";

  // ---- Google Docs (2 dạng: /d/<ID> và /d/e/<PUB_ID>/pub) ----
  // Dạng publish sẵn: /document/d/e/<PUB_ID>/pub...
  let m = raw.match(
    /docs\.google\.com\/document\/d\/e\/([^/]+)\/pub(?:[^\s]*)?/i
  );
  if (m) {
    return addEmbeddedParam(`https://docs.google.com/document/d/e/${m[1]}/pub`);
  }
  // Dạng chưa publish: /document/d/<ID>/...
  m = raw.match(/docs\.google\.com\/document\/d\/([^/]+)/i);
  if (m) {
    // tốt nhất là đã Publish → /pub?embedded=true
    return addEmbeddedParam(`https://docs.google.com/document/d/${m[1]}/pub`);
    // nếu file chưa publish, link này sẽ 404 → hãy Publish to the web trước
  }

  // ---- Google Slides ----
  m = raw.match(/docs\.google\.com\/presentation\/d\/([^/]+)/i);
  if (m) {
    // embed viewer chính thức của Slides
    return `https://docs.google.com/presentation/d/${m[1]}/embed?start=false&loop=false&delayms=3000`;
  }

  // ---- Google Sheets ----
  m = raw.match(/docs\.google\.com\/spreadsheets\/d\/([^/]+)/i);
  if (m) {
    // htmlview thường chạy được; nếu đã Publish thì có thể dùng /pubhtml (ổn định hơn)
    // return `https://docs.google.com/spreadsheets/d/${m[1]}/pubhtml?widget=true&headers=false`;
    return `https://docs.google.com/spreadsheets/d/${m[1]}/htmlview`;
  }

  // ---- Google Drive preview (ảnh/video/audio/tài liệu) ----
  m = raw.match(/drive\.google\.com\/file\/d\/([^/]+)/i);
  if (m) return `https://drive.google.com/file/d/${m[1]}/preview`;
  const q = raw.match(/[?&]id=([^&]+)/i);
  if (q) return `https://drive.google.com/file/d/${q[1]}/preview`;

  // ---- Office Online viewer cho docx/xlsx/pptx ----
  if (/\.(docx|xlsx|pptx)(\?|$)/i.test(raw)) {
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(
      raw
    )}`;
  }

  // ---- PDF: dùng Google Viewer để tăng tương thích mobile (KHÔNG convert) ----
  if (/\.pdf(\?|$)/i.test(raw)) {
    return `https://docs.google.com/viewer?embedded=true&url=${encodeURIComponent(
      raw
    )}`;
  }

  // fallback: trả nguyên (có thể bị chặn iframe tùy server nguồn)
  return raw;
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url") || "";
  const mode = (req.nextUrl.searchParams.get("mode") || "").toLowerCase(); // "embed" | "viewer" | "raw"
  if (!raw) return new Response("Missing url", { status: 400 });

  const embedUrl = normalizeToEmbed(raw);

  // Fallback universal viewer của Google (đặc biệt hữu ích cho PDF/định dạng lạ)
  const viewerUrl = `https://docs.google.com/viewer?embedded=true&url=${encodeURIComponent(
    raw
  )}`;

  // Nếu người dùng ép mode thì theo mode
  if (mode === "embed") return Response.redirect(embedUrl, 302);
  if (mode === "viewer") return Response.redirect(viewerUrl, 302);
  if (mode === "raw") return Response.redirect(raw, 302);

  // Mặc định: nếu đã nhận dạng & tạo được URL embed → dùng embed (HTML gốc)
  // Nếu không nhận dạng được (embedUrl === raw), dùng viewerUrl làm phương án an toàn hơn trên mobile
  const target = embedUrl && embedUrl !== raw ? embedUrl : viewerUrl;

  return Response.redirect(target, 302);
}
