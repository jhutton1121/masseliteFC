const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function uploadAvatar(
  bucket: R2Bucket,
  userId: string,
  file: File
): Promise<string> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Invalid file type. Use JPEG, PNG, or WebP.");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error("File too large. Maximum 5MB.");
  }

  const ext = file.type.split("/")[1] === "jpeg" ? "jpg" : file.type.split("/")[1];
  const key = `avatars/${userId}.${ext}`;

  await bucket.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });

  return key;
}

export async function deleteAvatar(
  bucket: R2Bucket,
  key: string
): Promise<void> {
  await bucket.delete(key);
}

export async function getAvatarUrl(
  bucket: R2Bucket,
  key: string | null
): Promise<string | null> {
  if (!key) return null;

  const object = await bucket.head(key);
  if (!object) return null;

  // For public access, you'd configure a custom domain on R2
  // For now, we serve via a route
  return `/api/avatar/${encodeURIComponent(key)}`;
}
