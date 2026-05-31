"use client";
import { useEffect, useRef } from "react";
import { useImageStore } from "@/lib/imageStore";
import DownloadBtn from "./DownloadBtn";

const FORMAT_OPTIONS = ["jpeg", "png", "webp"] as const;

function fmtSize(kb: number) {
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb.toFixed(0)} KB`;
}

export default function Editor() {
  const library        = useImageStore((s) => s.library);
  const selectedId     = useImageStore((s) => s.selectedId);
  const settings       = useImageStore((s) => s.settings);
  const result         = useImageStore((s) => s.result);
  const processing     = useImageStore((s) => s.processing);
  const updateSettings = useImageStore((s) => s.updateSettings);
  const processImage   = useImageStore((s) => s.processImage);

  // Track the last selectedId that was auto-processed so we only auto-process
  // once per image selection, never on settings changes.
  const lastAutoProcessedId = useRef<string | null>(null);

  useEffect(() => {
    // Only auto-process when the user selects a different image — not when
    // settings change. This prevents the "erratic focus" bug caused by the
    // store running processImage (which used to hit the network) mid-edit.
    if (selectedId && selectedId !== lastAutoProcessedId.current) {
      lastAutoProcessedId.current = selectedId;
      processImage();
    }
  }, [selectedId, processImage]);

  const entry = library.find((e) => e.id === selectedId);
  if (!entry) return null;

  // Guard against NaN
  const w = (!settings.width  || isNaN(settings.width))  ? entry.width  : settings.width;
  const h = (!settings.height || isNaN(settings.height)) ? entry.height : settings.height;

  const savings    = result ? entry.originalSizeKB - result.sizeKB : 0;
  const savingsPct = result ? (savings / entry.originalSizeKB) * 100 : 0;

  return (
    <section aria-label="Editor" className="flex flex-col gap-4">

      {/* Section label */}
      <h2
        className="text-xs font-semibold tracking-wider uppercase"
        style={{ color: "var(--muted)" }}
      >
        Editor — {entry.name.toUpperCase()}
      </h2>

      {/* 12-column responsive grid (matches reference HTML) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 lg:gap-8 items-start">

        {/* ─── LEFT: Settings (col 4/5) ─── */}
        <div
          className="col-span-1 md:col-span-4 lg:col-span-5 rounded-xl p-6 flex flex-col gap-8"
          style={{ background: "var(--surface)", border: "1px solid var(--bd)" }}
        >
          {/* Panel header */}
          <div
            className="flex items-center gap-2 text-lg font-medium pb-4"
            style={{ borderBottom: "1px solid var(--bd)" }}
          >
            <i className="fa-solid fa-sliders" style={{ color: "var(--muted)" }} />
            Settings
          </div>

          {/* Output format */}
          <div className="flex flex-col gap-3">
            <label className="text-sm" style={{ color: "var(--text)" }}>Output format</label>
            <div
              className="flex gap-2 p-1 rounded-lg"
              style={{ background: "var(--bg)", border: "1px solid var(--bd)" }}
            >
              {FORMAT_OPTIONS.map((fmt) => {
                const active = settings.format === fmt;
                return (
                  <button
                    key={fmt}
                    onClick={() => updateSettings({ format: fmt })}
                    aria-pressed={active}
                    className="flex-1 py-2 rounded-md text-sm font-medium transition-colors"
                    style={{
                      background: active ? "var(--primary)" : "transparent",
                      color: active ? "#ffffff" : "var(--muted)",
                      boxShadow: active ? "0 1px 3px rgba(0,0,0,0.3)" : "none",
                    }}
                    onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.color = "var(--text)"; }}
                    onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.color = "var(--muted)"; }}
                  >
                    {fmt.toUpperCase()}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dimensions */}
          <div className="flex flex-col gap-3">
            <label className="text-sm" style={{ color: "var(--text)" }}>Dimensions (px)</label>
            <div className="flex items-center gap-4">
              <input
                type="number"
                min={1} max={10000}
                value={w}
                onChange={(e) => updateSettings({ width: Number(e.target.value) })}
                className="w-full rounded-lg py-2 px-3 outline-none transition-colors"
                style={{
                  background: "var(--bg)",
                  border: "1px solid var(--bd)",
                  color: "var(--text)",
                }}
                onFocus={(e) => { (e.target as HTMLElement).style.borderColor = "var(--primary)"; }}
                onBlur={(e)  => { (e.target as HTMLElement).style.borderColor = "var(--bd)"; }}
              />
              {/* × between inputs — matches reference */}
              <i className="fa-solid fa-xmark text-xs flex-shrink-0" style={{ color: "var(--muted)" }} />
              <input
                type="number"
                min={1} max={10000}
                value={h}
                onChange={(e) => updateSettings({ height: Number(e.target.value) })}
                disabled={settings.lockAspect}
                className="w-full rounded-lg py-2 px-3 outline-none transition-colors"
                style={{
                  background: "var(--bg)",
                  border: "1px solid var(--bd)",
                  color: "var(--text)",
                  opacity: settings.lockAspect ? 0.5 : 1,
                }}
                onFocus={(e) => { (e.target as HTMLElement).style.borderColor = "var(--primary)"; }}
                onBlur={(e)  => { (e.target as HTMLElement).style.borderColor = "var(--bd)"; }}
              />
            </div>
            {/* Lock aspect ratio */}
            <label className="flex items-center gap-2 cursor-pointer mt-1">
              <input
                type="checkbox"
                checked={settings.lockAspect}
                onChange={(e) => updateSettings({ lockAspect: e.target.checked })}
                className="rounded"
                style={{ accentColor: "var(--primary)", width: "15px", height: "15px" }}
              />
              <span className="text-sm" style={{ color: "var(--muted)" }}>Lock aspect ratio</span>
            </label>
          </div>

          {/* Quality */}
          {settings.format !== "png" ? (
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <label className="text-sm" style={{ color: "var(--text)" }}>
                  Quality — <span className="font-bold">{settings.quality}%</span>
                </label>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs" style={{ color: "var(--muted)" }}>Small</span>
                <input
                  type="range"
                  min={1} max={100}
                  value={settings.quality}
                  onChange={(e) => updateSettings({ quality: Number(e.target.value) })}
                  style={{ accentColor: "var(--primary)" }}
                />
                <span className="text-xs" style={{ color: "var(--muted)" }}>Best</span>
              </div>
            </div>
          ) : (
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              PNG is lossless — quality not applicable.
            </p>
          )}

          {/* Apply Changes button */}
          <button
            onClick={() => processImage()}
            disabled={processing}
            aria-label="Apply changes"
            className="w-full rounded-lg py-2.5 flex items-center justify-center gap-2 font-semibold text-sm transition-all"
            style={{
              background: processing ? "var(--bd)" : "var(--primary)",
              color: "#ffffff",
              cursor: processing ? "not-allowed" : "pointer",
              opacity: processing ? 0.7 : 1,
            }}
            onMouseEnter={(e) => { if (!processing) (e.currentTarget as HTMLElement).style.filter = "brightness(1.1)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.filter = "brightness(1)"; }}
          >
            {processing ? (
              <>
                <i className="fa-solid fa-spinner fa-spin" />
                Processing…
              </>
            ) : (
              <>
                <i className="fa-solid fa-bolt" />
                Apply Changes
              </>
            )}
          </button>

          {/* Download button container */}
          <DownloadBtn />
        </div>

        {/* ─── RIGHT: Preview & result (col 8/7) ─── */}
        <div
          className="col-span-1 md:col-span-8 lg:col-span-7 rounded-xl p-4 flex flex-col gap-3"
          style={{ background: "var(--surface)", border: "1px solid var(--bd)" }}
        >
          {/* Panel header */}
          <div
            className="flex items-center gap-2 text-lg font-medium pb-2"
            style={{ borderBottom: "1px solid var(--bd)" }}
          >
            <i className="fa-solid fa-eye" style={{ color: "var(--muted)" }} />
            Preview &amp; result
          </div>

          {/* Image preview */}
          <div
            className="rounded-lg overflow-hidden flex justify-center items-center p-2 relative"
            style={{ background: "var(--bg)", border: "1px solid var(--bd)" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={result ? URL.createObjectURL(result.blob) : entry.previewUrl}
              alt="Preview"
              className="w-full h-auto object-contain rounded-sm"
              style={{ maxHeight: "320px" }}
            />
            {/* Processing overlay */}
            {processing && (
              <div
                className="absolute inset-0 flex items-center justify-center rounded-lg"
                style={{ background: "rgba(0,0,0,0.45)" }}
              >
                <i className="fa-solid fa-spinner fa-spin text-white text-2xl" />
              </div>
            )}
          </div>

          {/* Info row */}
          <div className="flex justify-between items-center text-[11px]" style={{ color: "var(--muted)" }}>
            <span>
              {result ? `${result.width} × ${result.height} px` : `${entry.width} × ${entry.height} px`}
            </span>
            <span>
              {result
                ? `${result.format.toUpperCase()} @ ${settings.quality}%`
                : "Original"}
            </span>
          </div>

          {/* Size comparison cards */}
          <div className="grid grid-cols-2 gap-1.5">
            <div
              className="rounded-md px-2 py-1.5"
              style={{ background: "var(--bg)", border: "1px solid var(--bd)" }}
            >
              <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: "var(--muted)" }}>Original</div>
              <div className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                {fmtSize(entry.originalSizeKB)}
              </div>
            </div>
            <div
              className="rounded-md px-2 py-1.5"
              style={{ background: "var(--bg)", border: "1px solid var(--bd)" }}
            >
              <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: "var(--muted)" }}>New size</div>
              <div
                className="text-sm font-semibold"
                style={{ color: result ? "var(--success)" : "var(--muted)" }}
              >
                {result ? fmtSize(result.sizeKB) : "—"}
              </div>
            </div>
          </div>

          {/* Savings / progress */}
          {result && savings > 0 && (
            <div
              className="rounded-md px-2 py-1.5 flex items-center gap-1.5"
              style={{ background: "var(--bg)", border: "1px solid var(--bd)" }}
            >
              <div className="text-sm" style={{ color: "var(--success)" }}>
                <i className="fa-solid fa-circle-check" />
              </div>
              <div className="flex-grow flex flex-col gap-1">
                <div className="text-[10px] font-medium" style={{ color: "var(--text)" }}>
                  Saved {fmtSize(savings)} ({savingsPct.toFixed(0)}%)
                </div>
                <div className="w-full rounded-full h-1 overflow-hidden" style={{ background: "var(--bd)" }}>
                  <div
                    className="h-1 rounded-full transition-all duration-500"
                    style={{
                      background: "var(--success)",
                      width: `${Math.min(savingsPct, 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {result && savings <= 0 && (
            <div
              className="rounded-lg p-4 flex items-center gap-3 text-sm"
              style={{ background: "var(--bg)", border: "1px solid var(--bd)", color: "#f59e0b" }}
            >
              <i className="fa-solid fa-triangle-exclamation" />
              File size grew — image was upscaled beyond its original size.
            </div>
          )}

        </div>
      </div>

    </section>
  );
}