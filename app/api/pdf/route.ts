// app/api/pdf/route.ts
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return new Response("Missing url", { status: 400 });
  }

  const range = req.headers.get("range") || undefined;

  const upstream = await fetch(url, {
    headers: range ? { Range: range } : {},
    redirect: "follow",
  });

  // Stream body
  const headers = new Headers();
  headers.set("Access-Control-Allow-Origin", "*");
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
}
