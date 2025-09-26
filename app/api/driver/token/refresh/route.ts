// app/api/driver/token/refresh/route.ts
export const runtime = "edge";

interface RefreshRequest {
  refresh_token: string;
}

function json(res: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(res, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8" },
    ...init,
  });
}

/**
 * Test triggers:
 * - Header: x-test-rate: 1      => 429 RATE_LIMITED
 * - refresh_token = "expired"   => 401 TOKEN_EXPIRED
 * - refresh_token = "revoked"   => 401 TOKEN_REVOKED
 */
export async function POST(req: Request) {
  try {
    const body: RefreshRequest = await req
      .json()
      .catch(() => ({ refresh_token: "" }));
    const { refresh_token } = body;

    if (!refresh_token) {
      return json(
        {
          success: false,
          error_code: "BAD_REQUEST",
          message: "Thiếu refresh_token",
        },
        { status: 400 }
      );
    }

    if (req.headers.get("x-test-rate") === "1") {
      return json(
        {
          success: false,
          error_code: "RATE_LIMITED",
          message: "Bạn thao tác quá nhanh.",
        },
        { status: 429 }
      );
    }

    if (refresh_token === "expired") {
      return json(
        {
          success: false,
          error_code: "TOKEN_EXPIRED",
          message: "Refresh token đã hết hạn.",
        },
        { status: 401 }
      );
    }

    if (refresh_token === "revoked") {
      return json(
        {
          success: false,
          error_code: "TOKEN_REVOKED",
          message: "Refresh token đã bị thu hồi.",
        },
        { status: 401 }
      );
    }

    const now = Math.floor(Date.now() / 1000);
    return json(
      {
        token_type: "Bearer",
        access_token: "new_access_" + now,
        expires_in: 3600,
      },
      { status: 200 }
    );
  } catch {
    return json(
      { success: false, error_code: "INTERNAL_ERROR", message: "Lỗi hệ thống" },
      { status: 500 }
    );
  }
}
