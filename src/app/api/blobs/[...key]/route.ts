import { NextRequest, NextResponse } from "next/server";
import { blobStorage } from "@/lib/blob-storage";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ key: string[] }> },
) {
  const { key: parts } = await ctx.params;
  const key = parts.map(decodeURIComponent).join("/");
  if (!key || key.includes("..")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const blob = await blobStorage.get(key);
  if (!blob) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(Buffer.from(blob.bytes), {
    status: 200,
    headers: {
      "Content-Type": blob.contentType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
