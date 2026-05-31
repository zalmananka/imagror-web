"use client";
import { useRef, useState, useEffect, DragEvent } from "react";
import { useImageStore } from "@/lib/imageStore";

const ACCEPTED_MIME = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"];

/** Toast notification — shown on paste/URL errors, auto-hides after 4 s. */
function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function show(msg: string) {
    if (timerRef.current) clearTimeout(timerRef.current);
    setMessage(msg);
    timerRef.current = setTimeout(() => setMessage(null), 4000);
  }

  return { message, show };
}

export default function Uploader() {
  const addImages  = useImageStore((s) => s.addImages);
  const addFromUrl = useImageStore((s) => s.addFromUrl);
  const [dragging,   setDragging]   = useState(false);
  const [urlInput,   setUrlInput]   = useState("");
  const [urlLoading, setUrlLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const { message: toastMsg, show: showToast } = useToast();

  // ── Global clipboard paste listener ────────────────────────────────────────
  useEffect(() => {
    function handlePaste(e: ClipboardEvent) {
      // Do NOT intercept when the user is typing inside a text/textarea input,
      // so normal text-paste (e.g. pasting a URL string) works as expected.
      const target = e.target as HTMLElement;
      const isTextInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      if (isTextInput) return;

      const items = Array.from(e.clipboardData?.items ?? []);
      const imageItem = items.find(
        (item) => item.kind === "file" && ACCEPTED_MIME.includes(item.type)
      );

      if (!imageItem) {
        // Clipboard has content but it's not a supported image — stay silent
        // (don't confuse users who paste text elsewhere on the page).
        return;
      }

      const file = imageItem.getAsFile();
      if (!file) return;

      // Give the pasted file a friendly name if it doesn't have one
      const name =
        file.name && file.name !== "image.png" ? file.name : `pasted-image.${file.type.split("/")[1] || "png"}`;
      const namedFile = new File([file], name, { type: file.type });

      addImages([namedFile]);
      showToast("📋 Image pasted from clipboard!");
    }

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [addImages, showToast]);

  // ── File helpers ────────────────────────────────────────────────────────────
  function handleFiles(files: FileList | null) {
    if (!files) return;
    const valid = Array.from(files).filter((f) => ACCEPTED_MIME.includes(f.type));
    if (valid.length) addImages(valid);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  }

  async function handleFetch() {
    if (!urlInput.trim() || urlLoading) return;
    setUrlLoading(true);
    try {
      await addFromUrl(urlInput.trim());
      setUrlInput("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to fetch image.";
      showToast(`⚠️ ${msg}`);
    } finally {
      setUrlLoading(false);
    }
  }

  return (
    <section aria-label="Upload Images" className="flex flex-col gap-4">

      {/* Drop zone */}
      <div
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        role="button"
        tabIndex={0}
        aria-label="Upload images"
        onKeyDown={(e) => e.key === "Enter" && fileRef.current?.click()}
        className="group border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center cursor-pointer transition-colors"
        style={{
          borderColor: dragging ? "var(--primary)" : "var(--bd)",
          background: dragging ? "rgba(59,130,246,0.05)" : "rgba(24,24,27,0.5)",
        }}
        onMouseEnter={(e) => { if (!dragging) (e.currentTarget as HTMLElement).style.background = "var(--surface)"; }}
        onMouseLeave={(e) => { if (!dragging) (e.currentTarget as HTMLElement).style.background = "rgba(24,24,27,0.5)"; }}
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
          multiple
          style={{ display: "none" }}
          onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
        />

        {/* fa-arrow-up-from-bracket icon — matches reference */}
        <i
          className="fa-solid fa-arrow-up-from-bracket mb-4 transition-colors"
          style={{ fontSize: "1.875rem", color: dragging ? "var(--primary)" : "var(--muted)" }}
        />

        <p className="text-lg mb-1 text-center" style={{ color: "var(--text)" }}>
          Drag &amp; drop images here, or{" "}
          <span
            className="hover:underline cursor-pointer"
            style={{ color: "var(--primary)" }}
          >
            browse files
          </span>
        </p>
        <p className="text-sm text-center" style={{ color: "var(--muted)" }}>
          PNG, JPG, WEBP, GIF — or <kbd className="px-1 py-0.5 rounded text-xs" style={{ background: "var(--bd)" }}>Ctrl+V</kbd> to paste from clipboard
        </p>
      </div>

      {/* URL row */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-grow">
          <input
            ref={urlInputRef}
            type="text"
            placeholder="Or paste an image URL..."
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleFetch()}
            className="w-full rounded-lg py-3 px-4 outline-none transition-all"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--bd)",
              color: "var(--text)",
            }}
            aria-label="Image URL"
          />
        </div>
        <button
          onClick={handleFetch}
          disabled={urlLoading || !urlInput.trim()}
          className="rounded-lg font-medium flex items-center gap-2 transition-colors px-6 py-3"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--bd)",
            color: "var(--text)",
            opacity: (urlLoading || !urlInput.trim()) ? 0.5 : 1,
            cursor: (urlLoading || !urlInput.trim()) ? "not-allowed" : "pointer",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--surface-hover)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--surface)"; }}
        >
          <i className="fa-solid fa-download" />
          {urlLoading ? "Loading…" : "Fetch"}
        </button>
      </div>

      {/* Toast notification */}
      {toastMsg && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl text-sm font-medium shadow-xl transition-all"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--bd)",
            color: "var(--text)",
            backdropFilter: "blur(12px)",
          }}
        >
          {toastMsg}
        </div>
      )}

    </section>
  );
}