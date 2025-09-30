// app/api/pdf/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import type { NextRequest } from "next/server";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Range, Content-Type, Accept",
  "Access-Control-Expose-Headers":
    "Content-Length, Content-Range, Accept-Ranges, Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function HEAD(req: NextRequest) {
  return GET(req, /*headOnly*/ true);
}

export async function GET(req: NextRequest, headOnly = false) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url)
    return new Response("Missing url", { status: 400, headers: CORS_HEADERS });

  try {
    const range = req.headers.get("range") || undefined;

    const upstream = await fetch(url, {
      headers: range ? { Range: range } : {},
      redirect: "follow",
    });

    // Stream body unless this is HEAD
    const body = headOnly ? null : upstream.body;

    const headers = new Headers(CORS_HEADERS);

    // Luôn hiển thị inline để tránh tải về/mở app ngoài
    headers.set("Content-Disposition", 'inline; filename="file.pdf"');

    // Loại nội dung
    headers.set(
      "Content-Type",
      upstream.headers.get("content-type") || "application/pdf"
    );

    // Truyền các header quan trọng cho PDF.js
    const cl = upstream.headers.get("content-length");
    if (cl) headers.set("Content-Length", cl);

    const cr = upstream.headers.get("content-range");
    if (cr) headers.set("Content-Range", cr);

    // Nếu upstream không báo, vẫn nên cho biết server **có** hỗ trợ range.
    // (Nếu upstream thực sự KHÔNG hỗ trợ, client vẫn có thể hoạt động với disableRange/data)
    headers.set(
      "Accept-Ranges",
      upstream.headers.get("accept-ranges") || "bytes"
    );

    // Giữ động, tránh cache sai với range
    headers.set("Cache-Control", "no-store");
    headers.set("Vary", "Origin, Range");

    return new Response(body, {
      status: upstream.status, // 200 hoặc 206 nếu là partial
      statusText: upstream.statusText,
      headers,
    });
  } catch (e) {
    return new Response("Proxy error", { status: 500, headers: CORS_HEADERS });
  }
}
