// lib/auth-store.ts

// Mở rộng được nhưng không dùng `any`:
// - Cho phép mọi key với kiểu `unknown`
// - Có thể (không bắt buộc) có `id: number`
export type DriverProfile = { id?: number } & Record<string, unknown>;

type TokenRecord<T extends DriverProfile> = {
  profile: T;
  expiresAt: number; // ms epoch
};

const accessStore = new Map<string, TokenRecord<DriverProfile>>();
const refreshStore = new Map<string, { driverId: number; expiresAt: number }>();

export function issueTokensWithProfile<T extends DriverProfile>(opts: {
  profile: T;
  accessTtlSec: number;
  refreshTtlSec: number;
}) {
  sweep(); // dọn rác token hết hạn

  const access_token = `mock_access_${Math.random().toString(36).slice(2)}`;
  const refresh_token = `mock_refresh_${Math.random().toString(36).slice(2)}`;
  const now = Date.now();

  accessStore.set(access_token, {
    profile: opts.profile,
    expiresAt: now + opts.accessTtlSec * 1000,
  });

  // Nếu có id dạng number thì lưu, không thì 0
  const driverId = typeof opts.profile.id === "number" ? opts.profile.id : 0;

  refreshStore.set(refresh_token, {
    driverId,
    expiresAt: now + opts.refreshTtlSec * 1000,
  });

  return { access_token, refresh_token };
}

// Generic để nơi gọi có thể chỉ định kiểu profile cụ thể mà KHÔNG dùng `any`
export function verifyAccessToken<T extends DriverProfile = DriverProfile>(
  accessToken: string
) {
  const rec = accessStore.get(accessToken);
  if (!rec) return { ok: false as const, reason: "not_found" as const };
  if (Date.now() > rec.expiresAt) {
    accessStore.delete(accessToken);
    return { ok: false as const, reason: "expired" as const };
  }
  return { ok: true as const, profile: rec.profile as T };
}

function sweep() {
  const now = Date.now();
  for (const [k, v] of accessStore)
    if (now > v.expiresAt) accessStore.delete(k);
  for (const [k, v] of refreshStore)
    if (now > v.expiresAt) refreshStore.delete(k);
}
