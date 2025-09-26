// =============================================
// FILE: app/api/mock-data.ts
// =============================================
export const runtime = "edge";

/* ================================
 * DỮ LIỆU MOCK
 * ================================ */
export const MOCK_DRIVER = {
  id: 123,
  name: "Nguyen Van A",
  phone_number: "0912345678",
  license_plate: "75A-12345",
  status: "active",
};

// ✅ Token hard-cứng
export const MOCK_ACCESS_TOKEN = "demo_access_token";
export const MOCK_REFRESH_TOKEN = "demo_refresh_token";

/* ================================
 * HELPER JSON RESPONSE
 * ================================ */
export function json<T>(res: T, init?: ResponseInit): Response {
  return new Response(JSON.stringify(res, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8" },
    ...init,
  });
}
