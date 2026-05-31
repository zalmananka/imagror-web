"use client";
import Uploader from "@/components/Uploader";
import Gallery from "@/components/Gallery";
import Editor from "@/components/Editor";
import { useImageStore } from "@/lib/imageStore";

export default function Home() {
  const library = useImageStore((s) => s.library);

  return (
    <main className="w-full max-w-[1200px] flex flex-col gap-8">

      {/* ── Header ── */}
      <header className="flex items-center justify-between py-2">
        <div className="flex items-center gap-3 text-xl font-semibold">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src="/image21.png" 
            alt="IMGRoar Logo" 
            className="h-8 w-auto object-contain"
            style={{ filter: "drop-shadow(0 0 6px rgba(255, 255, 255, 0.5)) drop-shadow(0 0 2px rgba(255, 255, 255, 0.8))" }}
          />
          <h1>IMGRoar</h1>
        </div>
        {library.length > 0 && (
          <div
            className="px-3 py-1 rounded-full text-sm font-medium border"
            style={{
              background: "rgba(20, 83, 45, 0.3)",
              color: "#4ade80",
              borderColor: "rgba(22, 101, 52, 0.5)",
            }}
          >
            {library.length} image{library.length !== 1 ? "s" : ""}
          </div>
        )}
      </header>

      <Uploader />
      <Gallery />
      <Editor />

    </main>
  );
}