// =============================================
// FILE: app/api/driver/verify-otp/route.ts
// =============================================
export const runtime = "edge";

type OtpRequest = {
  session_id: string;
  otp_code: string;
};

type OtpSuccess = {
  success: true;
  message: string;
  token_type: "Bearer";
  access_token: string;
  expires_in: number;
  refresh_token: string;
  driver: {
    id: number;
    name: string;
    phone_number: string;
    status: "active" | "inactive";
  };
  vehicle: {
    id: number;
    license_plate: string;
    type: string;
    status: "active" | "inactive";
  };
  permissions: Array<"trip.view" | "trip.accept" | "trip.update_location">;
};

type OtpErrorCode =
  | "BAD_REQUEST"
  | "SESSION_NOT_FOUND"
  | "OTP_EXPIRED"
  | "OTP_INVALID"
  | "OTP_LOCKED"
  | "ACCOUNT_INACTIVE"
  | "VEHICLE_NOT_ALLOWED"
  | "VEHICLE_INACTIVE"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

type OtpError = {
  success: false;
  error_code: OtpErrorCode;
  message: string;
};

function json2<T>(res: T, init?: ResponseInit): Response {
  return new Response(JSON.stringify(res, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8" },
    ...init,
  });
}

export async function POST(req: Request): Promise<Response> {
  try {
    const body = (await req.json().catch(() => null)) as OtpRequest | null;
    const session_id = body?.session_id ?? "";
    const otp_code = body?.otp_code ?? "";

    if (!session_id || !otp_code) {
      const resp: OtpError = {
        success: false,
        error_code: "BAD_REQUEST",
        message: "Thiếu tham số: session_id, otp_code",
      };
      return json2(resp, { status: 400 });
    }

    if (req.headers.get("x-test-rate") === "1") {
      const resp: OtpError = {
        success: false,
        error_code: "RATE_LIMITED",
        message: "Bạn thao tác quá nhanh. Vui lòng thử lại sau.",
      };
      return json2(resp, { status: 429 });
    }

    if (session_id === "sess-not-found") {
      return json2(
        {
          success: false,
          error_code: "SESSION_NOT_FOUND",
          message: "Phiên không tồn tại hoặc đã bị xoá.",
        } as OtpError,
        { status: 404 }
      );
    }
    if (session_id === "sess-expired") {
      return json2(
        {
          success: false,
          error_code: "OTP_EXPIRED",
          message: "OTP đã hết hạn. Vui lòng yêu cầu mã mới.",
        } as OtpError,
        { status: 410 }
      );
    }
    if (session_id === "sess-locked") {
      return json2(
        {
          success: false,
          error_code: "OTP_LOCKED",
          message:
            "Phiên bị khoá tạm thời do nhập sai quá số lần cho phép. Vui lòng thử lại sau.",
        } as OtpError,
        { status: 423 }
      );
    }
    if (session_id === "sess-inactive") {
      return json2(
        {
          success: false,
          error_code: "ACCOUNT_INACTIVE",
          message: "Tài khoản đang không hoạt động. Vui lòng liên hệ hỗ trợ.",
        } as OtpError,
        { status: 403 }
      );
    }
    if (session_id === "sess-veh-not-allowed") {
      return json2(
        {
          success: false,
          error_code: "VEHICLE_NOT_ALLOWED",
          message: "Phương tiện không được phép hoạt động.",
        } as OtpError,
        { status: 403 }
      );
    }
    if (session_id === "sess-veh-inactive") {
      return json2(
        {
          success: false,
          error_code: "VEHICLE_INACTIVE",
          message: "Phương tiện đang không hoạt động.",
        } as OtpError,
        { status: 403 }
      );
    }

    const attemptsHeader = req.headers.get("x-otp-attempts");
    const parsed = attemptsHeader ? Number.parseInt(attemptsHeader, 10) : 0;
    const failedAttempts = Number.isNaN(parsed)
      ? 0
      : Math.max(0, Math.min(2, parsed));

    if (otp_code !== "123456") {
      if (failedAttempts >= 2) {
        return json2(
          {
            success: false,
            error_code: "OTP_LOCKED",
            message:
              "Phiên bị khoá tạm thời do nhập sai quá số lần cho phép. Vui lòng thử lại sau.",
          } as OtpError,
          { status: 423 }
        );
      }
      const remaining = 2 - failedAttempts;
      return json2(
        {
          success: false,
          error_code: "OTP_INVALID",
          message: `Mã OTP không đúng. Bạn còn ${remaining} lần thử.`,
        } as OtpError,
        { status: 401 }
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const success: OtpSuccess = {
      success: true,
      message: "Xác thực OTP thành công",
      token_type: "Bearer",
      access_token: `mock_access_${now}`,
      expires_in: 3600,
      refresh_token: `mock_refresh_${now}`,
      driver: {
        id: 1024,
        name: "Nguyễn Văn A",
        phone_number: "+84905123456",
        status: "active",
      },
      vehicle: {
        id: 501,
        license_plate: "92A-12345",
        type: "truck_5t",
        status: "active",
      },
      permissions: ["trip.view", "trip.accept", "trip.update_location"],
    };
    return json2(success, { status: 200 });
  } catch {
    const resp: OtpError = {
      success: false,
      error_code: "INTERNAL_ERROR",
      message: "Lỗi hệ thống",
    };
    return json2(resp, { status: 500 });
  }
}
