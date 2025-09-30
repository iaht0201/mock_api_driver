// app/api/pdf-url/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import type { NextRequest } from "next/server";

function normalizeToPdf(url = ""): string {
  if (!url) return "";
  if (/\.pdf(\?|$)/i.test(url)) return url;

  const doc = url.match(/docs\.google\.com\/document\/d\/([^/]+)/);
  if (doc)
    return `https://docs.google.com/document/d/${doc[1]}/export?format=pdf`;

  const slides = url.match(/docs\.google\.com\/presentation\/d\/([^/]+)/);
  if (slides)
    return `https://docs.google.com/presentation/d/${slides[1]}/export/pdf`;

  const sheets = url.match(/docs\.google\.com\/spreadsheets\/d\/([^/]+)/);
  if (sheets)
    return `https://docs.google.com/spreadsheets/d/${sheets[1]}/export?format=pdf`;

  const byPath = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  const byQuery = url.match(/[?&]id=([^&]+)/);
  const id = byPath?.[1] || byQuery?.[1];
  if (id) return `https://drive.google.com/uc?export=download&id=${id}`;

  return url;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json; charset=utf-8",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url") || "";
  if (!raw) {
    return new Response(JSON.stringify({ error: "Missing url" }), {
      status: 400,
      headers: CORS,
    });
  }

  const exportUrl = normalizeToPdf(raw);
  const proxiedUrl = exportUrl
    ? `${req.nextUrl.origin}/api/pdf?url=${encodeURIComponent(exportUrl)}`
    : "";

  const viewerUrl = proxiedUrl
    ? `https://docs.google.com/viewer?embedded=true&url=${encodeURIComponent(
        proxiedUrl
      )}`
    : "";

  return new Response(JSON.stringify({ exportUrl, proxiedUrl, viewerUrl }), {
    status: 200,
    headers: CORS,
  });
}
