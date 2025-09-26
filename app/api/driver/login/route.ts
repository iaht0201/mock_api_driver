import { json, MOCK_DRIVER } from "../../mock-data";

export const runtime = "edge";

// Hard-coded for testing
const FIXED_OTP_TX_ID = "otp_tx_test_0001";
const OTP_EXPIRES_IN = 300; // 5 phút
const RESEND_AFTER = 30; // 30s

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => null)) as {
    license_plate: string;
    phone_number: string;
    password: string;
  } | null;

  if (!body?.license_plate || !body?.phone_number || !body?.password) {
    return json(
      {
        success: false,
        error_code: "BAD_REQUEST",
        message: "Thiếu tham số: license_plate, phone_number, password",
      },
      { status: 400 }
    );
  }

  if (
    body.license_plate !== "75A-12345" ||
    body.phone_number !== "0912345678" ||
    body.password !== "123456"
  ) {
    return json(
      {
        success: false,
        error_code: "INVALID_CREDENTIALS",
        message: "Sai thông tin đăng nhập",
      },
      { status: 401 }
    );
  }

  const expiresAt = new Date(Date.now() + OTP_EXPIRES_IN * 1000).toISOString();
  const maskedPhone = body.phone_number.replace(/\d(?=\d{4})/g, "*"); // ****5678

  return json(
    {
      success: true,
      message: "Khởi tạo OTP thành công",
      data: {
        otp_tx_id: FIXED_OTP_TX_ID,
        session_id: FIXED_OTP_TX_ID,
        expires_in: OTP_EXPIRES_IN,
        expires_at: expiresAt,
        resend_after: RESEND_AFTER,
        masked_phone: maskedPhone,
        driver_preview: {
          id: MOCK_DRIVER.id,
          name: MOCK_DRIVER.name,
          license_plate: MOCK_DRIVER.license_plate,
          status: MOCK_DRIVER.status,
        },
      },
    },
    { status: 200 }
  );
}
