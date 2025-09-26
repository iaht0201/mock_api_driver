import { json } from "../../mock-data";

export const runtime = "edge";

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => null)) as {
    session_id: string;
  } | null;

  if (!body?.session_id) {
    return json(
      {
        success: false,
        error_code: "BAD_REQUEST",
        message: "Thiếu tham số: session_id",
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

  return json(
    {
      success: true,
      message: "OTP mới đã được gửi",
      expired_in: 300,
      otp_demo: "123456", // ✅ Hard-cứng luôn 123456
    },
    { status: 200 }
  );
}
