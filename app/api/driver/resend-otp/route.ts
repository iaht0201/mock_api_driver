// =============================================
// FILE: app/api/driver/resend-otp/route.ts
// =============================================
export const runtime = "edge";

type ResendRequest = { session_id: string };

type ResendSuccess = {
  success: true;
  message: string;
  expired_in: number; // seconds
};

type ResendErrorCode =
  | "BAD_REQUEST"
  | "SESSION_NOT_FOUND"
  | "OTP_EXPIRED"
  | "OTP_LOCKED"
  | "ALREADY_VERIFIED"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

type ResendError = {
  success: false;
  error_code: ResendErrorCode;
  message: string;
};

function json3<T>(res: T, init?: ResponseInit): Response {
  return new Response(JSON.stringify(res, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8" },
    ...init,
  });
}

export async function POST(req: Request): Promise<Response> {
  try {
    const body = (await req.json().catch(() => null)) as ResendRequest | null;
    const session_id = body?.session_id ?? "";

    if (!session_id) {
      const resp: ResendError = {
        success: false,
        error_code: "BAD_REQUEST",
        message: "Thiếu tham số: session_id",
      };
      return json3(resp, { status: 400 });
    }

    if (req.headers.get("x-test-rate") === "1") {
      const resp: ResendError = {
        success: false,
        error_code: "RATE_LIMITED",
        message: "Bạn thao tác quá nhanh. Vui lòng thử lại sau.",
      };
      return json3(resp, { status: 429 });
    }

    if (session_id === "sess-not-found") {
      return json3(
        {
          success: false,
          error_code: "SESSION_NOT_FOUND",
          message: "Phiên không tồn tại hoặc đã bị xoá.",
        } as ResendError,
        { status: 404 }
      );
    }
    if (session_id === "sess-expired") {
      return json3(
        {
          success: false,
          error_code: "OTP_EXPIRED",
          message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
        } as ResendError,
        { status: 410 }
      );
    }
    if (session_id === "sess-locked") {
      return json3(
        {
          success: false,
          error_code: "OTP_LOCKED",
          message:
            "Phiên bị khoá tạm thời do nhập sai quá số lần cho phép. Vui lòng thử lại sau.",
        } as ResendError,
        { status: 423 }
      );
    }
    if (session_id === "sess-verified") {
      return json3(
        {
          success: false,
          error_code: "ALREADY_VERIFIED",
          message: "Phiên đã được xác thực. Không thể gửi lại OTP.",
        } as ResendError,
        { status: 409 }
      );
    }

    const countHeader = req.headers.get("x-resend-count");
    const lastSecsHeader = req.headers.get("x-last-resend-secs");
    const resendCount = countHeader ? Number.parseInt(countHeader, 10) : 0;
    const secsSinceLast = lastSecsHeader
      ? Number.parseInt(lastSecsHeader, 10)
      : 9999;

    if (!Number.isNaN(resendCount) && resendCount >= 3) {
      return json3(
        {
          success: false,
          error_code: "RATE_LIMITED",
          message:
            "Đã vượt quá số lần gửi lại OTP cho phép trong phiên (tối đa 3 lần).",
        } as ResendError,
        { status: 429 }
      );
    }

    if (!Number.isNaN(secsSinceLast) && secsSinceLast < 60) {
      const remain = 60 - Math.max(0, secsSinceLast);
      return json3(
        {
          success: false,
          error_code: "RATE_LIMITED",
          message: `Bạn vừa yêu cầu OTP. Vui lòng thử lại sau ${remain}s.`,
        } as ResendError,
        { status: 429 }
      );
    }

    const success: ResendSuccess = {
      success: true,
      message: "OTP đã được gửi lại",
      expired_in: 300,
    };
    return json3(success, { status: 200 });
  } catch {
    const resp: ResendError = {
      success: false,
      error_code: "INTERNAL_ERROR",
      message: "Lỗi hệ thống",
    };
    return json3(resp, { status: 500 });
  }
}
