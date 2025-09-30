// app/api/embed-proxy/route.ts
import type { NextRequest } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function addEmbeddedParam(u: string) {
  if (!u) return "";
  return /[?&]embedded=true/i.test(u)
    ? u
    : (u.includes("?") ? `${u}&embedded=true` : `${u}?embedded=true`);
}

function normalizeDocsPublish(raw = "") {
  if (!raw) return "";
  // /document/d/e/<PUB_ID>/pub
  let m = raw.match(/docs\.google\.com\/document\/d\/e\/([^/]+)\/pub/i);
  if (m) return addEmbeddedParam(`https://docs.google.com/document/d/e/${m[1]}/pub`);
  // /document/d/<ID>  (yêu cầu đã Publish; nếu chưa → 404)
  m = raw.match(/docs\.google\.com\/document\/d\/([^/]+)/i);
  if (m) return addEmbeddedParam(`https://docs.google.com/document/d/${m[1]}/pub`);
  return addEmbeddedParam(raw);
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url") || "";
  if (!raw) return new Response("Missing url", { status: 400, headers: CORS });

  const embedUrl = normalizeDocsPublish(raw);

  try {
    const upstream = await fetch(embedUrl, {
      headers: { "User-Agent": req.headers.get("user-agent") || "Mozilla/5.0" },
      redirect: "follow",
    });
    if (!upstream.ok) {
      return new Response(`Upstream ${upstream.status}`, { status: 502, headers: CORS });
    }

    let html = await upstream.text();

    // <base> để các đường dẫn tương đối (nếu có) vẫn đúng
    const baseTag = `<base href="https://docs.google.com/">`;

    // >>> CSS bạn cần: ẩn banner publish + bỏ padding .c12 (+ reset nhẹ)
    const injectedCss = `
      <style>
        /* Ẩn các vùng banner publish/credit hay gặp */
        #publish-banner, .publish-banner, .docos-punch-viewer-banner,
        .docs-ml-header, header[role="banner"], .header, .footer {
          display: none !important;
        }

        /* Reset viền/mép chung */
        html, body { margin:0 !important; padding:0 !important; }
        * { box-sizing: border-box; }

        /* Bỏ padding/margin của .c12 (class auto-gen của Docs) */
        .c12 { padding: 0 !important; margin: 0 !important; }

        /* Thường vùng nội dung có class này khi publish -> xoá khoảng trống nếu có */
        .doc-content { padding: 0 !important; margin: 0 !important; }

        /* Ảnh/video full chiều ngang */
        img, video { max-width: 100% !important; height: auto !important; }
      </style>
    `;

    // chèn vào <head>
    if (/<head[^>]*>/i.test(html)) {
      html = html.replace(/<head[^>]*>/i, (m) => `${m}\n${baseTag}\n${injectedCss}\n`);
    } else {
      html = html.replace(/<html[^>]*>/i, (m) => `${m}<head>${baseTag}${injectedCss}</head>`);
    }

    return new Response(html, {
      status: 200,
      headers: {
        ...CORS,
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response("Proxy error", { status: 500, headers: CORS });
  }
}
