// =============================================
// FILE: app/api/driver/login/route.ts
// =============================================
export const runtime = "edge";

type LoginRequest = {
  license_plate: string;
  phone_number: string;
  password: string;
};

type Driver = {
  id: number;
  name: string;
  phone_number: string;
  license_plate: string;
  status: "active" | "inactive";
};

type LoginSuccess = {
  success: true;
  message: string;
  data: {
    driver: Driver;
    access_token: string;
    token_type: "Bearer";
    expires_in: number;
    refresh_token: string;
    refresh_expires_in: number;
  };
};

type ErrorCode =
  | "BAD_REQUEST"
  | "INVALID_ACCOUNT"
  | "INVALID_CREDENTIALS"
  | "ACCOUNT_LOCKED"
  | "ACCOUNT_INACTIVE"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

type ErrorResponse = {
  success: false;
  error_code: ErrorCode;
  message: string;
};

function normalizePlate(raw: string): string {
  const s = raw.toUpperCase().replace(/\s+/g, "");
  return s.includes("-")
    ? s
    : s.replace(/(^[0-9A-Z]{2,3})([0-9A-Z]+)/, "$1-$2");
}

function normalizePhone(raw: string): string {
  let s = raw.replace(/\s+/g, "").replace(/[^+0-9]/g, "");
  if (/^0\d{9,10}$/.test(s)) s = "+84" + s.slice(1);
  return s;
}

function json<T>(res: T, init?: ResponseInit): Response {
  return new Response(JSON.stringify(res, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8" },
    ...init,
  });
}

export async function POST(req: Request): Promise<Response> {
  try {
    const body = (await req.json().catch(() => null)) as LoginRequest | null;
    const license_plate = body?.license_plate ?? "";
    const phone_number = body?.phone_number ?? "";
    const password = body?.password ?? "";

    if (!license_plate || !phone_number || !password) {
      const resp: ErrorResponse = {
        success: false,
        error_code: "BAD_REQUEST",
        message: "Thiếu tham số: license_plate, phone_number, password",
      };
      return json(resp, { status: 400 });
    }

    const lp = normalizePlate(license_plate);
    const phone = normalizePhone(phone_number);

    if (req.headers.get("x-test-rate") === "1") {
      const resp: ErrorResponse = {
        success: false,
        error_code: "RATE_LIMITED",
        message: "Bạn thao tác quá nhanh. Vui lòng thử lại sau.",
      };
      return json(resp, { status: 429 });
    }

    if (phone === "+84000000000") {
      const resp: ErrorResponse = {
        success: false,
        error_code: "INVALID_ACCOUNT",
        message: "Biển số xe hoặc số điện thoại không hợp lệ",
      };
      return json(resp, { status: 401 });
    }

    if (password === "inactive") {
      const resp: ErrorResponse = {
        success: false,
        error_code: "ACCOUNT_INACTIVE",
        message: "Tài khoản đang không hoạt động. Vui lòng liên hệ hỗ trợ.",
      };
      return json(resp, { status: 403 });
    }

    if (password === "lock") {
      const resp: ErrorResponse = {
        success: false,
        error_code: "ACCOUNT_LOCKED",
        message:
          "Tài khoản bị khoá tạm thời do nhập sai quá số lần cho phép. Vui lòng thử lại sau.",
      };
      return json(resp, { status: 423 });
    }

    if (password === "wrong") {
      const resp: ErrorResponse = {
        success: false,
        error_code: "INVALID_CREDENTIALS",
        message: "Mật khẩu không đúng",
      };
      return json(resp, { status: 401 });
    }

    const now = Math.floor(Date.now() / 1000);
    const success: LoginSuccess = {
      success: true,
      message: "Đăng nhập thành công",
      data: {
        driver: {
          id: 123,
          name: "Nguyen Van A",
          phone_number: phone,
          license_plate: lp,
          status: "active",
        },
        access_token: `mock_access_token_${now}`,
        token_type: "Bearer",
        expires_in: 3600,
        refresh_token: `mock_refresh_token_${now}`,
        refresh_expires_in: 2592000,
      },
    };
    return json(success, { status: 200 });
  } catch {
    const resp: ErrorResponse = {
      success: false,
      error_code: "INTERNAL_ERROR",
      message: "Lỗi hệ thống",
    };
    return json(resp, { status: 500 });
  }
}
