import { NextResponse, type NextRequest } from "next/server";
import { storage } from "@/lib/storage";
import { LocalStorageDriver } from "@/lib/storage/local";

const KEY_PATTERN = /^(products|media)\/[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)?\/w\d{2,4}\.webp$/;

/** Serves processed images when using the local storage driver (development only). */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ key: string[] }> }) {
  const driver = storage();
  if (!(driver instanceof LocalStorageDriver)) return new NextResponse("Not found", { status: 404 });
  const key = (await params).key.join("/");
  // Only finished renditions are public; raw uploads under uploads/ are never served.
  if (!KEY_PATTERN.test(key)) return new NextResponse("Not found", { status: 404 });
  const body = await driver.getObject(key);
  if (!body) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
