// app/api/driver/verify-otp/route.ts
// Mock verify OTP theo session_id, OTP hard-cứng '123456'

export const runtime = "edge";

// ====== Mock chung (có thể tách vào app/api/mock-data.ts nếu bạn muốn) ======
const MOCK_DRIVER = {
  id: 1024,
  name: "Nguyễn Văn A",
  phone_number: "+84905123456",
  status: "active" as const,
};

const MOCK_VEHICLE = {
  id: 501,
  license_plate: "92A-12345",
  type: "truck_5t",
  status: "active",
};

// Token hard-cứng
const MOCK_ACCESS_TOKEN = "demo_access_token";
const MOCK_REFRESH_TOKEN = "demo_refresh_token";

// ====== Session store (in-memory) ======
// Lưu ý: Ở môi trường Edge/serverless, state có thể không bền giữa các instance.
// Đây chỉ là mock cho FE dev/test.
type SessionState = {
  sessionId: string;
  expiresAt: number; // epoch seconds
  failedAttempts: number; // số lần nhập sai hiện tại
  lockedUntil?: number; // epoch seconds nếu đang bị khoá
  verified?: boolean; // đã verify xong
};

const FIFTEEN_MIN = 15 * 60;
const TEN_MIN = 10 * 60;

// Khởi tạo vài session mẫu:
// - sess-ok: hợp lệ, chưa verify, chưa khoá, hết hạn sau 10 phút từ khi cold start
// - sess-expired: coi như đã hết hạn
// - sess-locked: đang bị khoá
const nowSec = () => Math.floor(Date.now() / 1000);

const SESSIONS = new Map<string, SessionState>([
  [
    "sess-ok",
    {
      sessionId: "sess-ok",
      expiresAt: nowSec() + TEN_MIN, // còn hạn ~10 phút
      failedAttempts: 0,
    },
  ],
  [
    "sess-expired",
    {
      sessionId: "sess-expired",
      expiresAt: nowSec() - 1, // đã hết hạn
      failedAttempts: 0,
    },
  ],
  [
    "sess-locked",
    {
      sessionId: "sess-locked",
      expiresAt: nowSec() + TEN_MIN,
      failedAttempts: 3,
      lockedUntil: nowSec() + FIFTEEN_MIN, // đang khoá 15p
    },
  ],
]);

// ====== Helpers ======
function json<T>(res: T, init?: ResponseInit): Response {
  return new Response(JSON.stringify(res, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8" },
    ...init,
  });
}

function errorJson(status: number, code: string, message: string) {
  return json(
    {
      success: false,
      error_code: code,
      message,
    },
    { status }
  );
}

// ====== POST /api/driver/verify-otp ======
export async function POST(req: Request): Promise<Response> {
  try {
    const body = (await req.json().catch(() => null)) as {
      session_id: string;
      otp_code: string;
    } | null;

    if (!body?.session_id || !body?.otp_code) {
      return errorJson(
        400,
        "BAD_REQUEST",
        "Thiếu tham số: session_id, otp_code"
      );
    }

    const sess = SESSIONS.get(body.session_id);
    if (!sess) {
      return errorJson(
        404,
        "SESSION_NOT_FOUND",
        "Phiên không tồn tại hoặc đã bị xoá."
      );
    }

    // Hết hạn tổng
    if (nowSec() > sess.expiresAt) {
      return errorJson(
        410,
        "OTP_EXPIRED",
        "OTP đã hết hạn. Vui lòng yêu cầu mã mới."
      );
    }

    // Đang bị khoá do nhập sai nhiều
    if (sess.lockedUntil && nowSec() < sess.lockedUntil) {
      return errorJson(
        423,
        "OTP_LOCKED",
        "Phiên bị khoá tạm thời do nhập sai quá số lần cho phép. Vui lòng thử lại sau."
      );
    }

    // So khớp OTP — hard-cứng '123456'
    const isCorrect = body.otp_code === "123456";
    if (!isCorrect) {
      sess.failedAttempts = Math.min(3, (sess.failedAttempts ?? 0) + 1);

      // Nếu >= 3 lần sai -> khoá 10-15 phút (ở đây set 15p)
      if (sess.failedAttempts >= 3) {
        sess.lockedUntil = nowSec() + FIFTEEN_MIN;
        return errorJson(
          423,
          "OTP_LOCKED",
          "Phiên bị khoá tạm thời do nhập sai quá số lần cho phép. Vui lòng thử lại sau."
        );
      }

      const remaining = 3 - sess.failedAttempts; // 2,1
      return errorJson(
        401,
        "OTP_INVALID",
        `Mã OTP không đúng. Bạn còn ${remaining} lần thử.`
      );
    }

    // Đúng OTP -> đánh dấu verified, vô hiệu hoá OTP (one-time)
    sess.verified = true;
    sess.failedAttempts = 0;
    // (tuỳ bạn) có thể set expiresAt = now để không thể verify lại lần 2

    // Cấp token + trả thông tin
    return json(
      {
        success: true,
        message: "Xác thực OTP thành công",
        token_type: "Bearer",
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: 3600,
        refresh_token: "demo_refresh_token", // có thể giữ cùng MOCK_REFRESH_TOKEN nếu muốn đồng bộ
        driver: MOCK_DRIVER,
        vehicle: MOCK_VEHICLE,
        permissions: ["trip.view", "trip.accept", "trip.update_location"],
      },
      { status: 200 }
    );
  } catch {
    return errorJson(500, "INTERNAL_ERROR", "Lỗi hệ thống");
  }
}
