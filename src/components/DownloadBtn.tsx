"use client";
import { useState, useEffect } from "react";
import { useImageStore } from "@/lib/imageStore";

const EXT_MAP = { jpeg: "jpg", png: "png", webp: "webp" } as const;

export default function DownloadBtn() {
  const result     = useImageStore((s) => s.result);
  const library    = useImageStore((s) => s.library);
  const selectedId = useImageStore((s) => s.selectedId);
  const [customName, setCustomName] = useState("");

  useEffect(() => {
    const entry = library.find((e) => e.id === selectedId);
    if (entry) {
      const baseName = entry.name.replace(/\.[^.]+$/, "");
      setCustomName(`IMGROR_${baseName}`);
    }
  }, [selectedId, library]);

  if (!result) return null;

  const ext      = EXT_MAP[result.format];
  const filename = `${customName || "image"}.${ext}`;

  function handleDownload() {
    const url = URL.createObjectURL(result!.blob);
    const a   = document.createElement("a");
    a.href     = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div
      className="w-full rounded-lg p-3 flex flex-col gap-3 mt-auto"
      style={{
        background: "var(--bg)",
        border: "1px solid var(--bd)",
      }}
    >
      {/* Download button - smaller, green, on top */}
      <button
        onClick={handleDownload}
        aria-label={`Download ${filename}`}
        className="w-full rounded-md py-2.5 flex items-center justify-center gap-2 transition-colors"
        style={{
          background: "var(--success)",
          color: "#ffffff",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.filter = "brightness(0.9)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.filter = "brightness(1)"; }}
      >
        <i className="fa-solid fa-download" />
        <span className="font-semibold text-sm">Download</span>
      </button>

      {/* Rename functionality - below button, font-mono, same text-xs size */}
      <div className="flex items-center justify-center px-2">
        <input
          type="text"
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          className="text-xs font-mono bg-transparent outline-none text-right truncate min-w-0"
          style={{ 
            color: "var(--muted)", 
            borderBottom: "1px dashed var(--bd)",
            width: "auto"
          }}
          placeholder="Filename"
        />
        <span className="text-xs font-mono flex-shrink-0" style={{ color: "var(--muted)" }}>
          .{ext}
        </span>
      </div>
    </div>
  );
}