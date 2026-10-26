import { NextResponse, type NextRequest } from "next/server";
import { getAdmin } from "@/lib/authz";
import { env } from "@/lib/env";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { isSameOrigin } from "@/lib/security";
import { storage } from "@/lib/storage";
import { LocalStorageDriver } from "@/lib/storage/local";
import { verifyUploadToken } from "@/lib/storage/signing";
import { sniffImageType } from "@/lib/validation/upload";

/**
 * Upload endpoint for the local (development) storage driver. Mirrors an S3 presigned
 * POST: the signed token fixes the key, content type, maximum size and expiry. The
 * caller must also be a signed-in administrator.
 */
export async function POST(request: NextRequest) {
  const driver = storage();
  if (!(driver instanceof LocalStorageDriver)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!checkRateLimit(`upload:${admin.id}`, RATE_LIMITS.upload).ok) return NextResponse.json({ error: "Too many uploads" }, { status: 429 });

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  const hardLimit = env().MAX_UPLOAD_MB * 1024 * 1024 + 64 * 1024;
  if (declaredLength > hardLimit) return NextResponse.json({ error: "File too large" }, { status: 413 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload" }, { status: 400 });
  }
  const token = form.get("token");
  const file = form.get("file");
  if (typeof token !== "string" || !(file instanceof File)) return NextResponse.json({ error: "Invalid upload" }, { status: 400 });

  const claims = verifyUploadToken(token, env().UPLOAD_SIGNING_SECRET!);
  if (!claims) return NextResponse.json({ error: "Upload link expired or invalid" }, { status: 403 });
  if (file.size <= 0 || file.size > claims.maxBytes) return NextResponse.json({ error: "File too large" }, { status: 413 });
  if (file.type !== claims.contentType) return NextResponse.json({ error: "Unexpected file type" }, { status: 415 });

  const bytes = Buffer.from(await file.arrayBuffer());
  if (sniffImageType(bytes) !== claims.contentType) return NextResponse.json({ error: "File content does not match its type" }, { status: 415 });

  await driver.putObject(claims.key, bytes);
  return new NextResponse(null, { status: 204 });
}
