function generateOtpCode(): string {
  const bytes = new Uint8Array(3);
  crypto.getRandomValues(bytes);
  const num = ((bytes[0] << 16) | (bytes[1] << 8) | bytes[2]) % 1000000;
  return num.toString().padStart(6, "0");
}

function generateId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createOtp(
  db: D1Database,
  phone: string
): Promise<string> {
  const code = generateOtpCode();
  const id = generateId();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  await db
    .prepare(
      "INSERT INTO otp_codes (id, phone, code, expires_at) VALUES (?, ?, ?, ?)"
    )
    .bind(id, phone, code, expiresAt)
    .run();

  return code;
}

export async function verifyOtp(
  db: D1Database,
  phone: string,
  code: string
): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT id FROM otp_codes
       WHERE phone = ? AND code = ? AND used = 0 AND expires_at > datetime('now')
       ORDER BY created_at DESC LIMIT 1`
    )
    .bind(phone, code)
    .first();

  if (!row) return false;

  await db
    .prepare("UPDATE otp_codes SET used = 1 WHERE id = ?")
    .bind(row.id as string)
    .run();

  return true;
}
