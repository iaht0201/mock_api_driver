// app/api/embed-proxy/route.ts
import type { NextRequest } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function addEmbeddedParam(u: string) {
  if (!u) return "";
  return /[?&]embedded=true/i.test(u)
    ? u
    : u.includes("?")
    ? `${u}&embedded=true`
    : `${u}?embedded=true`;
}

function normalizeDocsPublish(raw = "") {
  if (!raw) return "";
  // /document/d/e/<PUB_ID>/pub
  let m = raw.match(/docs\.google\.com\/document\/d\/e\/([^/]+)\/pub/i);
  if (m)
    return addEmbeddedParam(`https://docs.google.com/document/d/e/${m[1]}/pub`);
  // /document/d/<ID>  (yêu cầu đã Publish; nếu chưa → 404)
  m = raw.match(/docs\.google\.com\/document\/d\/([^/]+)/i);
  if (m)
    return addEmbeddedParam(`https://docs.google.com/document/d/${m[1]}/pub`);
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
      return new Response(`Upstream ${upstream.status}`, {
        status: 502,
        headers: CORS,
      });
    }

    let html = await upstream.text();

    // <base> để các đường dẫn tương đối (nếu có) vẫn đúng
    const baseTag = `<base href="https://docs.google.com/">`;

    // >>> CSS bạn cần: ẩn banner publish + bỏ padding .c12 (+ reset nhẹ)
    const injectedCss = `
<style>
  /* Ẩn banner, header, footer, vùng publish thừa */
  #publish-banner, .publish-banner, .docos-punch-viewer-banner,
  .docs-ml-header, header[role="banner"], .header, .footer {
    display: none !important;
  }

  /* Reset chung viền/mép, box-sizing */
  html, body { margin: 0 !important; padding: 0 !important; }
  * { box-sizing: border-box !important; }

  /* Responsive cho khối nội dung Docs (thường là .c12 hoặc doc-content) */
  .c12, .doc-content {
    max-width: 100vw !important;
    padding: 12px !important;
    margin: 0 !important;
    background-color: #fff !important;
    overflow-x: auto !important;
  }

  /* Chữ cơ bản: cân chỉnh cho mobile */
  body, .c0, .c1, .c3, .c5, .c7, .c8, .c9, .c10, .c11 {
    font-size: 1rem !important;
    line-height: 1.5 !important;
    word-break: break-word !important;
  }

  /* Responsive cho mọi ảnh/video: chiều ngang tối đa, không tràn */
  img, video {
    display: block !important;
    width: 100% !important;
    max-width: 100% !important;
    height: auto !important;
    margin: 8px auto !important;
    object-fit: contain !important;
  }

  /* Responsive tiêu đề: thu nhỏ cho mobile */
  h1, h2, h3, h4, h5, h6, .title, .subtitle {
    font-size: 1.3rem !important;
    padding-top: 8px !important;
    padding-bottom: 4px !important;
    line-height: 1.3 !important;
    word-break: break-word !important;
  }

  /* Danh sách và bullet - co sát mép, căn đều trái */
  ul, ol {
    margin: 8px 0 8px 18px !important;
    padding: 0 !important;
  }
  li {
    font-size: 1rem !important;
    line-height: 1.5 !important;
  }

  /* Bảng - tràn ngang khi nhỏ */
  table {
    width: 100% !important;
    overflow-x: auto !important;
    border-collapse: collapse !important;
  }
  th, td {
    padding: 6px !important;
    font-size: 0.95rem !important;
    word-break: break-word !important;
  }

  /* Chặn tràn: luôn cho phép cuộn ngang khi cần */
  .doc-content, .c12 {
    overflow-x: auto !important;
  }

  /* Media queries cho mobile siêu nhỏ (640px trở xuống) */
  @media (max-width: 640px) {
    html, body {
      font-size: 0.95rem !important;
      margin-left: 0 !important;
      margin-right: 0 !important;
      padding-left: 0 !important;
      padding-right: 0 !important;
    }
    .c12, .doc-content, body, html {
      padding-left: 0 !important;
      padding-right: 0 !important;
      margin-left: 0 !important;
      margin-right: 0 !important;
      max-width: 100vw !important;
      overflow-x: hidden !important;
    }
    /* Xóa thụt lề ngang mọi phần tử con */
    * {
      margin-left: 0 !important;
      margin-right: 0 !important;
      padding-left: 0 !important;
      padding-right: 0 !important;
    }
    h1, h2, h3, h4, h5, h6, .title, .subtitle {
      font-size: 1.1rem !important;
      padding-top: 6px !important;
      padding-bottom: 2px !important;
    }
    th, td {
      padding: 4px !important;
      font-size: 0.85rem !important;
    }
    img, video {
      margin: 4px auto !important;
    }
  }
</style>



    `;

    // chèn vào <head>
    if (/<head[^>]*>/i.test(html)) {
      html = html.replace(
        /<head[^>]*>/i,
        (m) => `${m}\n${baseTag}\n${injectedCss}\n`
      );
    } else {
      html = html.replace(
        /<html[^>]*>/i,
        (m) => `${m}<head>${baseTag}${injectedCss}</head>`
      );
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
