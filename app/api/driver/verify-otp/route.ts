import {
  json,
  MOCK_DRIVER,
  MOCK_ACCESS_TOKEN,
  MOCK_REFRESH_TOKEN,
} from "../../mock-data";

export const runtime = "edge";

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => null)) as {
    session_id: string;
    otp_code: string;
  } | null;

  if (!body?.session_id || !body?.otp_code) {
    return json(
      {
        success: false,
        error_code: "BAD_REQUEST",
        message: "Thiếu tham số: session_id, otp_code",
      },
      { status: 400 }
    );
  }

  if (body.session_id !== "sess-ok") {
    return json(
      {
        success: false,
        error_code: "SESSION_NOT_FOUND",
        message: "Phiên không tồn tại hoặc đã bị xoá.",
      },
      { status: 404 }
    );
  }

  if (body.otp_code !== "123456") {
    return json(
      {
        success: false,
        error_code: "OTP_INVALID",
        message: "Mã OTP không đúng",
      },
      { status: 401 }
    );
  }

  return json(
    {
      success: true,
      message: "Xác thực OTP thành công",
      token_type: "Bearer",
      access_token: MOCK_ACCESS_TOKEN,
      expires_in: 3600,
      refresh_token: MOCK_REFRESH_TOKEN,
      driver: MOCK_DRIVER,
      vehicle: {
        id: 501,
        license_plate: "75A-12345",
        type: "truck_5t",
        status: "active",
      },
      permissions: ["trip.view", "trip.accept", "trip.update_location"],
    },
    { status: 200 }
  );
}
