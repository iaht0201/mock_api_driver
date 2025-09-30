// app/api/pdf/route.ts
export const runtime = "nodejs"; // đảm bảo Node runtime
export const dynamic = "force-dynamic"; // tránh bị pre-render/cache tĩnh

import type { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return new Response("Missing url", { status: 400 });

  try {
    const range = req.headers.get("range") || undefined;

    const upstream = await fetch(url, {
      headers: range ? { Range: range } : {},
      redirect: "follow",
    });

    const headers = new Headers();
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set(
      "Access-Control-Expose-Headers",
      "Content-Length, Content-Range, Accept-Ranges"
    );
    headers.set("Cache-Control", "no-store"); // tránh cache sai với Range
    headers.set(
      "Content-Type",
      upstream.headers.get("content-type") || "application/pdf"
    );

    const cl = upstream.headers.get("content-length");
    if (cl) headers.set("Content-Length", cl);
    const cr = upstream.headers.get("content-range");
    if (cr) headers.set("Content-Range", cr);
    const ar = upstream.headers.get("accept-ranges");
    if (ar) headers.set("Accept-Ranges", ar);

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers,
    });
  } catch (e) {
    return new Response("Proxy error", { status: 500 });
  }
}
