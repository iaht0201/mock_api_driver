export const runtime = "edge";

const FAIL_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_FAILS = 5;
const ACCESS_EXPIRES_IN = 3600; // 1h
const REFRESH_EXPIRES_IN = 30 * 24 * 3600; // 30d

// Simple per-IP rate limit (mock)
const RATE_LIMIT_WINDOW_MS = 10 * 1000; // 10s
const RATE_LIMIT_MAX = 20; // 20 requests / 10s

// Per-identifier (phone+plate) auth failure state
const failureState = new Map<
  string,
  { count: number; firstAt: number; lockUntil?: number }
>();

// Per-IP rate limit state
const rateState = new Map<string, { count: number; windowStart: number }>();

// ===== Mocked driver record =====
// Adjust this to mirror your ../../mock-data if you prefer to import.
const MOCK_DRIVER = {
  id: 123,
  name: "Nguyen Van A",
  phone_number: "0905123456",
  license_plate: "92A-12345",
  status: "active" as "active" | "inactive" | "disabled",
  // Pre-hash password "123@123" using SHA-256 (demo only; use Argon2id/Bcrypt in production)
  password_hash_hex:
    "635772e64f62bc07612beaced11c3166207095e1cabfc2e9e8089fad0f5a1d38", // sha256("123@123")
};

// ===== Helpers =====
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
  // Accept 0xxxxxxxxx or +84xxxxxxxxx; normalize to local leading 0 for matching in this mock
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

  // Clear old window
  if (now - entry.firstAt > FAIL_WINDOW_MS) {
    entry.count = 0;
    entry.firstAt = now;
    entry.lockUntil = undefined;
  }

  // If locked and still within lock window
  if (entry.lockUntil && now < entry.lockUntil) {
    return { locked: true, lockUntil: entry.lockUntil } as const;
  }

  if (success) {
    // reset on success
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

function mockIssueTokens() {
  // This is a mock: return opaque strings shaped like JWTs
  const access_token = `mock_access_${Math.random().toString(36).slice(2)}`;
  const refresh_token = `mock_refresh_${Math.random().toString(36).slice(2)}`;
  return { access_token, refresh_token };
}

// ===== Handler =====
export async function POST(req: Request): Promise<Response> {
  // Rate limit (per-IP)
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

  // Lookup account (mock: match against MOCK_DRIVER)
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

  // Check account status
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

  // Check lock state before verifying password
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

  // Success: issue tokens
  const { access_token, refresh_token } = mockIssueTokens();

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

// ===== Notes =====
// • This is a mock suitable for Edge runtime. It uses Web Crypto SHA-256 for demo password hashing.
// • Replace SHA-256 with Argon2id/Bcrypt at your API/service layer in production.
// • Replace in-memory maps with a persistent store (DB/Redis) if you need shared state across instances.
// • To change the demo password, update password_hash_hex to sha256Hex(newPassword).
