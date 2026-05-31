"use client";
import { useImageStore } from "@/lib/imageStore";

function formatSize(kb: number) {
  if (kb >= 1024) return `${(kb / 1024).toFixed(1)} MB`;
  return `${kb.toFixed(0)} KB`;
}

export default function Gallery() {
  const library     = useImageStore((s) => s.library);
  const selectedId  = useImageStore((s) => s.selectedId);
  const selectImage = useImageStore((s) => s.selectImage);
  const removeImage = useImageStore((s) => s.removeImage);

  if (library.length === 0) return null;

  return (
    <section aria-label="Image Gallery" className="flex flex-col gap-4">

      {/* Section label — matches reference */}
      <h2
        className="text-xs font-semibold tracking-wider uppercase"
        style={{ color: "var(--muted)" }}
      >
        Gallery — Click to edit
      </h2>

      {/* Thumbnail grid */}
      <div className="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-8 gap-3">
        {library.map((entry) => {
          const selected = entry.id === selectedId;
          return (
            <div
              key={entry.id}
              onClick={() => selectImage(entry.id)}
              className={`relative aspect-square rounded-xl overflow-hidden cursor-pointer transition-colors ${
                selected
                  ? ""
                  : "opacity-80 hover:opacity-100"
              }`}
              style={{
                border: selected
                  ? "2px solid var(--primary)"
                  : "1px solid var(--bd)",
              }}
              onMouseEnter={(e) => {
                if (!selected)
                  (e.currentTarget as HTMLElement).style.borderColor = "var(--muted)";
              }}
              onMouseLeave={(e) => {
                if (!selected)
                  (e.currentTarget as HTMLElement).style.borderColor = "var(--bd)";
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={entry.previewUrl}
                alt={entry.name}
                className="w-full h-full object-cover"
              />

              {/* Selected: "editing" badge — top-right, blue pill */}
              {selected && (
                <div
                  className="absolute top-2 right-2 text-white text-xs px-2 py-1 rounded-full font-medium shadow-md"
                  style={{ background: "var(--primary)" }}
                >
                  editing
                </div>
              )}

              {/* Not selected: size badge */}
              {!selected && (
                <div
                  className="absolute top-2 right-2 text-white text-xs px-2 py-1 rounded-md font-medium"
                  style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}
                >
                  {formatSize(entry.originalSizeKB)}
                </div>
              )}

              {/* Remove × button on hover */}
              <button
                onClick={(e) => { e.stopPropagation(); removeImage(entry.id); }}
                aria-label={`Remove ${entry.name}`}
                className="remove-x absolute bottom-2 left-2 w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold transition-opacity"
                style={{ background: "rgba(0,0,0,0.55)", opacity: 0 }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#dc2626"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.55)"; }}
              >
                ×
              </button>

              <style jsx>{`
                div:hover .remove-x { opacity: 1 !important; }
              `}</style>
            </div>
          );
        })}
      </div>

    </section>
  );
}