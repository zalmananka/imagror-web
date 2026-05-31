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

  addImages: async (files) => {
    const entries = await Promise.all(files.map(fileToEntry));
    set((s) => ({ library: [...s.library, ...entries] }));
  },

  addFromUrl: async (url) => {
    const res = await fetch(`/api/fetch-url?url=${encodeURIComponent(url)}`);
    if (!res.ok) throw new Error("Failed to fetch image");
    const blob = await res.blob();
    const filename = url.split("/").pop()?.split("?")[0] || "url-image.jpg";
    const file = new File([blob], filename, { type: blob.type });
    const entry = await fileToEntry(file);
    set((s) => ({ library: [...s.library, entry] }));
  },

  removeImage: (id) => {
    set((s) => ({
      library: s.library.filter((e) => e.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
      result: s.selectedId === id ? null : s.result,
    }));
  },

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

  updateSettings: (patch) => {
    const { settings, selectedId, library } = get();
    const entry = library.find((e) => e.id === selectedId);
    if (!entry) return;

    const next = { ...settings, ...patch };

    // Enforce aspect ratio lock
    if (settings.lockAspect && entry.width && entry.height) {
      const ratio = entry.width / entry.height;
      if (patch.width !== undefined) next.height = Math.round(patch.width / ratio);
      if (patch.height !== undefined) next.width = Math.round(patch.height * ratio);
    }
    set({ settings: next });
  },

  processImage: async () => {
    const { selectedId, library, settings } = get();
    const entry = library.find((e) => e.id === selectedId);
    if (!entry) return;

    set({ processing: true });

    try {
      const form = new FormData();
      form.append("file", entry.file);
      form.append("width", String(settings.width));
      form.append("height", String(settings.height));
      form.append("quality", String(settings.quality));
      form.append("format", settings.format);

      const res = await fetch("/api/process-image", { method: "POST", body: form });
      if (!res.ok) throw new Error("Server error");

      const blob = await res.blob();
      const sizeKB = blob.size / 1024;

      set({
        result: {
          blob,
          sizeKB,
          width: settings.width,
          height: settings.height,
          format: settings.format,
        },
        processing: false,
      });
    } catch (e) {
      console.error(e);
      set({ processing: false });
    }
  },
}));