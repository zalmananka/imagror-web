// lib/imageStore.ts
import { create } from "zustand";

export type OutputFormat = "jpeg" | "png" | "webp";

export interface ImageEntry {
  id: string;
  name: string;
  file: File;
  previewUrl: string;       // object URL for display
  originalSizeKB: number;
  width: number;
  height: number;
}

export interface EditorSettings {
  width: number;
  height: number;
  quality: number;          // 10–100
  format: OutputFormat;
  lockAspect: boolean;
}

export interface ProcessedResult {
  blob: Blob;
  sizeKB: number;
  width: number;
  height: number;
  format: OutputFormat;
}

interface ImageStore {
  library: ImageEntry[];
  selectedId: string | null;
  settings: EditorSettings;
  result: ProcessedResult | null;
  processing: boolean;

  addImages: (files: File[]) => void;
  addFromUrl: (url: string) => Promise<void>;
  removeImage: (id: string) => void;
  selectImage: (id: string) => void;

  updateSettings: (patch: Partial<EditorSettings>) => void;
  processImage: () => Promise<void>;
}

function makeId() {
  return Math.random().toString(36).slice(2, 9);
}

async function fileToEntry(file: File): Promise<ImageEntry> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () =>
      resolve({
        id: makeId(),
        name: file.name,
        file,
        previewUrl: url,
        originalSizeKB: file.size / 1024,
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    img.onerror = reject;
    img.src = url;
  });
}

/**
 * Client-side image processing using the HTML5 Canvas API.
 * Resizes and converts the image to the requested format/quality
 * entirely in the browser — zero network round-trips.
 */
async function processImageOnClient(
  entry: ImageEntry,
  settings: EditorSettings
): Promise<Blob> {
  const { width, height, quality, format } = settings;

  // Load the source image from the object URL
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = entry.previewUrl;
  });

  // Draw at target dimensions
  const canvas = document.createElement("canvas");
  canvas.width  = width  || img.naturalWidth;
  canvas.height = height || img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  // High-quality downsampling via multiple steps if scale-down is large
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  // Map format → MIME + quality (PNG quality is irrelevant but toBlob accepts 0–1)
  const mimeMap: Record<OutputFormat, string> = {
    jpeg: "image/jpeg",
    png:  "image/png",
    webp: "image/webp",
  };
  const mime = mimeMap[format];
  // Canvas toBlob quality is 0–1; our slider is 1–100
  const q = format === "png" ? undefined : quality / 100;

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("toBlob returned null"));
      },
      mime,
      q
    );
  });
}

const DEFAULT_SETTINGS: EditorSettings = {
  width: 0,
  height: 0,
  quality: 85,
  format: "jpeg",
  lockAspect: true,
};

export const useImageStore = create<ImageStore>((set, get) => ({
  library: [],
  selectedId: null,
  settings: DEFAULT_SETTINGS,
  result: null,
  processing: false,

  // ─── addImages ──────────────────────────────────────────────────────────────
  // Auto-selects the first new image ONLY when nothing is currently selected.
  addImages: async (files) => {
    const entries = await Promise.all(files.map(fileToEntry));
    set((s) => {
      const hadSelection = s.selectedId !== null;
      const firstNew = entries[0];

      if (!hadSelection && firstNew) {
        // Auto-select the first uploaded image and seed settings
        return {
          library: [...s.library, ...entries],
          selectedId: firstNew.id,
          settings: {
            ...DEFAULT_SETTINGS,
            width: firstNew.width,
            height: firstNew.height,
          },
          result: null,
        };
      }

      // Keep the existing selection untouched
      return { library: [...s.library, ...entries] };
    });
  },

  // ─── addFromUrl ─────────────────────────────────────────────────────────────
  // Uses the /api/fetch-image server-side proxy to bypass CORS.
  addFromUrl: async (url) => {
    const res = await fetch(`/api/fetch-image?url=${encodeURIComponent(url)}`);
    if (!res.ok) {
      // Surface the server's error message if available
      let msg = "Failed to fetch image.";
      try {
        const body = await res.json() as { error?: string };
        if (body.error) msg = body.error;
      } catch { /* ignore parse errors */ }
      throw new Error(msg);
    }

    const blob = await res.blob();

    // Derive a clean filename from the URL path
    const rawName = url.split("/").pop()?.split("?")[0] || "url-image";
    // Ensure the extension matches the actual MIME type returned by the proxy
    const extMap: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
      "image/avif": "avif",
    };
    const ext = extMap[blob.type] ?? "jpg";
    const hasExt = /\.\w{2,5}$/.test(rawName);
    const filename = hasExt ? rawName : `${rawName}.${ext}`;

    const file = new File([blob], filename, { type: blob.type });
    const entry = await fileToEntry(file);

    set((s) => {
      const hadSelection = s.selectedId !== null;
      if (!hadSelection) {
        return {
          library: [...s.library, entry],
          selectedId: entry.id,
          settings: {
            ...DEFAULT_SETTINGS,
            width: entry.width,
            height: entry.height,
          },
          result: null,
        };
      }
      return { library: [...s.library, entry] };
    });
  },

  // ─── removeImage ────────────────────────────────────────────────────────────
  // When the removed image was selected, move focus to the adjacent image
  // so the editor never goes blank unnecessarily.
  removeImage: (id) => {
    set((s) => {
      const idx = s.library.findIndex((e) => e.id === id);
      const nextLibrary = s.library.filter((e) => e.id !== id);

      if (s.selectedId !== id) {
        // Not the selected image — nothing else changes
        return { library: nextLibrary };
      }

      // The deleted image was selected — pick a replacement
      if (nextLibrary.length === 0) {
        return { library: nextLibrary, selectedId: null, result: null };
      }

      // Prefer the image at the same index, fall back to the previous one
      const nextEntry = nextLibrary[idx] ?? nextLibrary[idx - 1];
      return {
        library: nextLibrary,
        selectedId: nextEntry.id,
        result: null,
        settings: {
          ...DEFAULT_SETTINGS,
          width: nextEntry.width,
          height: nextEntry.height,
        },
      };
    });
  },

  // ─── selectImage ────────────────────────────────────────────────────────────
  selectImage: (id) => {
    const entry = get().library.find((e) => e.id === id);
    if (!entry) return;
    set({
      selectedId: id,
      result: null,
      settings: {
        ...DEFAULT_SETTINGS,
        width: entry.width,
        height: entry.height,
      },
    });
  },

  // ─── updateSettings ─────────────────────────────────────────────────────────
  // NEVER touches selectedId — only updates settings values.
  updateSettings: (patch) => {
    const { settings, selectedId, library } = get();
    const entry = library.find((e) => e.id === selectedId);
    if (!entry) return;

    const next = { ...settings, ...patch };

    // Enforce aspect ratio lock
    if (settings.lockAspect && entry.width && entry.height) {
      const ratio = entry.width / entry.height;
      if (patch.width  !== undefined) next.height = Math.round(patch.width  / ratio);
      if (patch.height !== undefined) next.width  = Math.round(patch.height * ratio);
    }

    // Only update settings — selectedId is intentionally left alone
    set({ settings: next });
  },

  // ─── processImage ───────────────────────────────────────────────────────────
  // Fully client-side via Canvas API — no network requests.
  processImage: async () => {
    const { selectedId, library, settings } = get();
    const entry = library.find((e) => e.id === selectedId);
    if (!entry) return;

    set({ processing: true });

    try {
      const blob = await processImageOnClient(entry, settings);
      const sizeKB = blob.size / 1024;

      // Snapshot the selectedId at the time processing started so we don't
      // accidentally overwrite a different image's result if the user switched.
      const stillSelected = get().selectedId === selectedId;
      if (!stillSelected) return;

      set({
        result: {
          blob,
          sizeKB,
          width:  settings.width  || entry.width,
          height: settings.height || entry.height,
          format: settings.format,
        },
        processing: false,
      });
    } catch (e) {
      console.error("[processImage]", e);
      set({ processing: false });
    }
  },
}));