// app/api/fetch-image/route.ts
// Server-side proxy: fetches a remote image to bypass browser CORS restrictions.
import { NextRequest, NextResponse } from "next/server";

/** Maximum image size we'll proxy: 30 MB */
const MAX_BYTES = 30 * 1024 * 1024;

/** Allowed MIME types — reject anything that isn't a real image. */
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/svg+xml",
]);

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const imageUrl = searchParams.get("url");

  // ── Validate input ──────────────────────────────────────────────────────────
  if (!imageUrl) {
    return NextResponse.json({ error: "Missing `url` query parameter." }, { status: 400 });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(imageUrl);
  } catch {
    return NextResponse.json({ error: "Invalid URL." }, { status: 400 });
  }

  // Only allow http(s) — block file:// / data: / etc.
  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    return NextResponse.json({ error: "Only http/https URLs are allowed." }, { status: 400 });
  }

  // ── Fetch the remote image ──────────────────────────────────────────────────
  let upstream: Response;
  try {
    upstream = await fetch(imageUrl, {
      // Forward a neutral UA so servers don't block bots
      headers: { "User-Agent": "Mozilla/5.0 (compatible; IMGRor/1.0)" },
      // Abort if the remote server is slow
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    console.error("[fetch-image] upstream fetch failed:", err);
    return NextResponse.json({ error: "Failed to reach the remote server." }, { status: 502 });
  }

  if (!upstream.ok) {
    return NextResponse.json(
      { error: `Remote server returned ${upstream.status}.` },
      { status: 502 }
    );
  }

  // ── Validate Content-Type ──────────────────────────────────────────────────
  const rawMime = upstream.headers.get("content-type") ?? "";
  // Strip parameters like "; charset=utf-8"
  const mime = rawMime.split(";")[0].trim().toLowerCase();

  if (!ALLOWED_MIME.has(mime)) {
    return NextResponse.json(
      { error: `URL does not point to a supported image (got "${mime || "unknown"}").` },
      { status: 415 }
    );
  }

  // ── Read body with size guard ──────────────────────────────────────────────
  const arrayBuffer = await upstream.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_BYTES) {
    return NextResponse.json(
      { error: "Image exceeds the 30 MB size limit." },
      { status: 413 }
    );
  }

  // ── Return image buffer ───────────────────────────────────────────────────
  return new NextResponse(arrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Content-Length": String(arrayBuffer.byteLength),
      // Cache for 1 hour on the CDN/browser — same image URL = same bytes
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
