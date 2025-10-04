// app/api/auth/me/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken, type DriverProfile } from "@/lib/auth-store";

// ===== Types =====
type Payload = {
  data: DriverProfile;
  meta: { server_time: string; token_type: "Bearer" };
};

// Các khóa quan hệ có thể “nặng” để lọc bằng ?include=
const relationKeys = [
  "position",
  "license",
  "vehicle",
  "salary",
  "insurance",
  "today_summary",
  "today_shipments",
] as const;

type RelationKey = (typeof relationKeys)[number];

// Cho phép client gửi "vehicles" nhưng map về "vehicle"
function normalizeIncludeToken(token: string): RelationKey | null {
  const t = token.trim().toLowerCase();
  if (t === "vehicles") return "vehicle";
  if (relationKeys.includes(t as RelationKey)) return t as RelationKey;
  return null;
}

// Để xóa thuộc tính quan hệ mà vẫn type-safe, ta biến các quan hệ thành optional
type Strippable = Omit<DriverProfile, never> &
  Partial<Pick<DriverProfile, RelationKey>>;

function applyIncludeFilter(
  payload: Payload,
  includeParam: string | null
): Payload {
  if (!includeParam) return payload;

  const includeSet = new Set<RelationKey>();
  for (const raw of includeParam.split(",")) {
    const k = normalizeIncludeToken(raw);
    if (k) includeSet.add(k);
  }

  // Sao chép data và xóa các quan hệ không nằm trong includeSet
  const mutable: Strippable = { ...payload.data };
  for (const key of relationKeys) {
    if (!includeSet.has(key)) {
      delete mutable[key];
    }
  }

  return { ...payload, data: mutable as DriverProfile };
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const [scheme, token] = auth.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Thiếu hoặc sai Authorization header.",
        },
      },
      { status: 401 }
    );
  }

  const verified = verifyAccessToken<DriverProfile>(token);
  if (!verified.ok) {
    const msg =
      verified.reason === "expired"
        ? "Access token đã hết hạn."
        : "Access token không hợp lệ.";
    return NextResponse.json(
      { error: { code: "INVALID_TOKEN", message: msg } },
      { status: 401 }
    );
  }

  const include = new URL(req.url).searchParams.get("include");

  const payload: Payload = {
    data: verified.profile,
    meta: { server_time: new Date().toISOString(), token_type: "Bearer" },
  };

  const result = applyIncludeFilter(payload, include);
  return NextResponse.json(result, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}
