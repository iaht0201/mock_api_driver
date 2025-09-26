import {
  json,
  MOCK_DRIVER,
  MOCK_ACCESS_TOKEN,
  MOCK_REFRESH_TOKEN,
} from "../../mock-data";

export const runtime = "edge";

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

  return json(
    {
      success: true,
      message: "Đăng nhập thành công",
      data: {
        driver: MOCK_DRIVER,
        access_token: MOCK_ACCESS_TOKEN,
        token_type: "Bearer",
        expires_in: 3600,
        refresh_token: MOCK_REFRESH_TOKEN,
        refresh_expires_in: 2592000,
      },
    },
    { status: 200 }
  );
}
