// app/api/process-image/route.ts
import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

export const runtime = "nodejs"; // sharp requires Node.js runtime

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const width = parseInt(form.get("width") as string, 10);
    const height = parseInt(form.get("height") as string, 10);
    const quality = parseInt(form.get("quality") as string, 10);
    const format = (form.get("format") as string) || "jpeg";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let pipeline = sharp(buffer).resize(width, height, {
      fit: "fill",
      withoutEnlargement: false,
    });

    let outputBuffer: Buffer;
    let mimeType: string;

    switch (format) {
      case "png":
        pipeline = pipeline.png({ compressionLevel: Math.round((100 - quality) / 11) });
        mimeType = "image/png";
        break;
      case "webp":
        pipeline = pipeline.webp({ quality });
        mimeType = "image/webp";
        break;
      default:
        pipeline = pipeline.jpeg({ quality, mozjpeg: true });
        mimeType = "image/jpeg";
    }

    outputBuffer = await pipeline.toBuffer();

    return new NextResponse(new Uint8Array(outputBuffer), {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(outputBuffer.byteLength),
      },
    });
  } catch (err) {
    console.error("[process-image]", err);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
