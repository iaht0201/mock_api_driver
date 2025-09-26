import {
  json,
  MOCK_REFRESH_TOKEN,
  MOCK_ACCESS_TOKEN,
} from "../../../mock-data";

export const runtime = "edge";

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => null)) as {
    refresh_token: string;
  } | null;

  if (!body?.refresh_token) {
    return json(
      {
        success: false,
        error_code: "BAD_REQUEST",
        message: "Thiếu tham số: refresh_token",
      },
      { status: 400 }
    );
  }

  if (body.refresh_token !== MOCK_REFRESH_TOKEN) {
    return json(
      {
        success: false,
        error_code: "INVALID_REFRESH",
        message: "Refresh token không hợp lệ hoặc đã hết hạn",
      },
      { status: 401 }
    );
  }

  return json(
    {
      token_type: "Bearer",
      access_token: MOCK_ACCESS_TOKEN,
      expires_in: 3600,
    },
    { status: 200 }
  );
}
