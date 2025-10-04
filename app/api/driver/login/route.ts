// app/api/auth/login/route.ts
export const runtime = "nodejs";

import { DriverProfile, issueTokensWithProfile } from "@/lib/auth-store";

// ==== các hằng số y như bạn đưa ====
const FAIL_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_FAILS = 5;
const ACCESS_EXPIRES_IN = 3600; // 1h
const REFRESH_EXPIRES_IN = 30 * 24 * 3600; // 30d

const RATE_LIMIT_WINDOW_MS = 10 * 1000; // 10s
const RATE_LIMIT_MAX = 20; // 20 requests / 10s

const failureState = new Map<
  string,
  { count: number; firstAt: number; lockUntil?: number }
>();
const rateState = new Map<string, { count: number; windowStart: number }>();

const MOCK_DRIVER = {
  id: 12, // Khớp với /me
  name: "Trần Văn B",
  phone_number: "0905123456",
  license_plate: "92A-12345",
  status: "active" as const,
  // sha256("123@123")
  password_hash_hex:
    "635772e64f62bc07612beaced11c3166207095e1cabfc2e9e8089fad0f5a1d38",
};

// ===== Helpers (giữ nguyên các hàm bạn đã có) =====
function json(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json; charset=utf-8" },
    ...init,
  });
}
function normalizePlate(input: string) {
  return input.replace(/\s+/g, "").toUpperCase();
}
function normalizePhone(input: string) {
  const trimmed = input.replace(/\s+/g, "");
  if (trimmed.startsWith("+84")) return "0" + trimmed.slice(3);
  return trimmed;
}
async function sha256Hex(text: string) {
  const enc = new TextEncoder();
  const data = enc.encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
async function verifyPassword(plain: string, expectedHashHex: string) {
  const actual = await sha256Hex(plain);
  return actual === expectedHashHex;
}
function makeKey(phone: string, plate: string) {
  return `${phone}__${plate}`;
}
function checkRateLimit(ip: string) {
  const now = Date.now();
  const entry = rateState.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateState.set(ip, { count: 1, windowStart: now });
    return { ok: true } as const;
  }
  entry.count += 1;
  if (entry.count > RATE_LIMIT_MAX) return { ok: false } as const;
  return { ok: true } as const;
}
function checkAndUpdateLockout(key: string, success: boolean) {
  const now = Date.now();
  let entry = failureState.get(key);
  if (!entry) {
    entry = { count: 0, firstAt: now };
    failureState.set(key, entry);
  }
  if (now - entry.firstAt > FAIL_WINDOW_MS) {
    entry.count = 0;
    entry.firstAt = now;
    entry.lockUntil = undefined;
  }
  if (entry.lockUntil && now < entry.lockUntil) {
    return { locked: true, lockUntil: entry.lockUntil } as const;
  }
  if (success) {
    entry.count = 0;
    entry.firstAt = now;
    entry.lockUntil = undefined;
    return { locked: false } as const;
  } else {
    entry.count += 1;
    if (entry.count >= MAX_FAILS) {
      entry.lockUntil = now + FAIL_WINDOW_MS;
      return { locked: true, lockUntil: entry.lockUntil } as const;
    }
    return { locked: false } as const;
  }
}

// ===== Mock profile để lưu cùng token (chính là /me.data) =====
function buildDriverProfile() {
  return {
    id: 12,
    full_name: "Trần Văn B",
    username: "tranvb",
    email: "b@example.com",
    phone: "0905xxxxxx",
    role: "driver",
    status: "active",
    employee_code: "DRV-00123",
    gender_label: "Nam",
    birthday: "1990-09-01",
    join_date: "2024-03-15",
    avatar_url: "https://api.example.com/storage/avatars/u12.png",
    address: "Quảng Nam",
    id_number: "2010xxxxxx",
    id_number_issuance_date: "2016-08-30",
    position: { id: 5, name: "Tài xế", code: "DRV" },
    license: {
      license_number: "79A123456",
      license_type: "C",
      license_type_label: "C - Ô tô tải, kể cả kinh doanh",
      issue_date: "2022-01-01",
      expiry_date: "2027-01-01",
      issued_by: "Sở GTVT",
      status: "valid",
      status_label: "Còn hiệu lực",
      status_badge: "success",
      days_until_expiry: 825,
      file_url: "https://api.example.com/storage/driver_licenses/xxx.pdf",
      is_expired: false,
      is_expiring_soon: false,
    },
    vehicle: {
      id: 17,
      plate_number: "92A-12345",
      status: "active",
      status_label: "Đang hoạt động",
      vehicle_type: { id: 2, name: "Xe tải 5 tấn", code: "TRK_5T" },
      capacity: 5.0,
      manufactured_year: 2019,
      is_car_rental: false,
      rental_customer: null,
      total_distance: 18542,
      average_fuel_consumption: 6.2,
      available: true,
    },
    salary: {
      salary_type: "commission",
      salary_type_label: "Lương hoa hồng",
      salary_type_color: "warning",
      salary_base: 0,
      is_basic_salary: false,
      is_commission_salary: true,
      salary_by_percent: 12.0,
      lunch_allowance: { eligible: false, daily: 35000, monthly: 770000 },
    },
    insurance: {
      has_insurance: true,
      insurance_start_date: "2024-04-01",
      social_insurance_amount: 5500000,
      social_insurance_amount_label: "5,500,000 đ (Hệ thống)",
      status_label: "Đã đóng bảo hiểm từ 2024-04-01",
      status_color: "success",
    },
    today_summary: { total: 3, completed: 1, pending: 1 },
    today_shipments: [
      {
        id: 255,
        shipment_code: "SHP250928ABCD",
        status: "pending",
        status_label: "Tạo mới",
        run_date: "2025-09-28",
        departure_time: "2025-09-28T08:00:00",
        estimated_arrival_time: "2025-09-28T10:30:00",
        origin: "Kho A",
        origin2: "Kho B",
        origin3: null,
        destination: "Đà Nẵng",
        destination2: "Huế",
        destination3: null,
        address_origin: "123 Lê Lợi, Quảng Nam",
        address_origin2: "456 Nguyễn Huệ, Quảng Nam",
        address_origin3: null,
        address_destination: "789 Điện Biên Phủ, Đà Nẵng",
        address_destination2: null,
        address_destination3: null,
        product_name: "Xi măng",
        product_name2: "Sắt thép",
        product_name3: null,
        vehicle: {
          id: 17,
          plate_number: "92A-12345",
          is_car_rental: false,
          status: "active",
        },
        customer: { id: 5, name: "Aurum Logistics" },
        driver: { id: 12, name: "Trần Văn B" },
        co_driver: null,
        distance: 75,
        unit_price_for_driver: 1150000,
      },
    ],
  };
}

export async function POST(req: Request): Promise<Response> {
  // Rate limit
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = checkRateLimit(ip);
  if (!rl.ok) {
    return json(
      {
        success: false,
        error_code: "RATE_LIMITED",
        message: "Bạn thao tác quá nhanh. Vui lòng thử lại sau.",
      },
      { status: 429 }
    );
  }

  let body: {
    license_plate?: string;
    phone_number?: string;
    password?: string;
  } | null = null;
  try {
    body = await req.json();
  } catch {}

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

  const licensePlate = normalizePlate(body.license_plate);
  const phoneNumber = normalizePhone(body.phone_number);
  const password = body.password;

  // Match account
  if (
    licensePlate !== normalizePlate(MOCK_DRIVER.license_plate) ||
    phoneNumber !== normalizePhone(MOCK_DRIVER.phone_number)
  ) {
    return json(
      {
        success: false,
        error_code: "INVALID_ACCOUNT",
        message: "Biển số xe hoặc số điện thoại không hợp lệ",
      },
      { status: 401 }
    );
  }

  if (MOCK_DRIVER.status !== "active") {
    return json(
      {
        success: false,
        error_code: "ACCOUNT_INACTIVE",
        message: "Tài khoản đang không hoạt động. Vui lòng liên hệ hỗ trợ.",
      },
      { status: 403 }
    );
  }

  const key = makeKey(phoneNumber, licensePlate);
  const pre = failureState.get(key);
  if (pre?.lockUntil && Date.now() < pre.lockUntil) {
    return json(
      {
        success: false,
        error_code: "ACCOUNT_LOCKED",
        message:
          "Tài khoản bị khoá tạm thời do nhập sai quá số lần cho phép. Vui lòng thử lại sau.",
      },
      { status: 423 }
    );
  }

  const ok = await verifyPassword(password, MOCK_DRIVER.password_hash_hex);
  const lock = checkAndUpdateLockout(key, ok);

  if (!ok) {
    if (lock.locked) {
      return json(
        {
          success: false,
          error_code: "ACCOUNT_LOCKED",
          message:
            "Tài khoản bị khoá tạm thời do nhập sai quá số lần cho phép. Vui lòng thử lại sau.",
        },
        { status: 423 }
      );
    }
    return json(
      {
        success: false,
        error_code: "INVALID_CREDENTIALS",
        message: "Mật khẩu không đúng",
      },
      { status: 401 }
    );
  }

  // === Success: issue tokens & attach profile ===
  const profile: DriverProfile =
    buildDriverProfile() as unknown as DriverProfile;
  const { access_token, refresh_token } = issueTokensWithProfile({
    profile,
    accessTtlSec: ACCESS_EXPIRES_IN,
    refreshTtlSec: REFRESH_EXPIRES_IN,
  });

  return json(
    {
      success: true,
      message: "Đăng nhập thành công",
      data: {
        driver: {
          id: MOCK_DRIVER.id,
          name: MOCK_DRIVER.name,
          phone_number: phoneNumber,
          license_plate: licensePlate,
          status: MOCK_DRIVER.status,
        },
        access_token,
        token_type: "Bearer",
        expires_in: ACCESS_EXPIRES_IN,
        refresh_token,
        refresh_expires_in: REFRESH_EXPIRES_IN,
      },
    },
    { status: 200 }
  );
}
