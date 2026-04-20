/// <reference types="vite/client" />

// File System Access API types — not in the standard DOM lib yet.
// Only used behind runtime feature checks (showSaveFilePicker in window).
interface FilePickerAcceptType {
  description?: string;
  accept: Record<string, string[]>;
}

interface SaveFilePickerOptions {
  suggestedName?: string;
  types?: FilePickerAcceptType[];
}

interface OpenFilePickerOptions {
  types?: FilePickerAcceptType[];
  multiple?: boolean;
}

interface FileSystemWritableFileStream extends WritableStream {
  write(data: string | BufferSource | Blob): Promise<void>;
  close(): Promise<void>;
}

interface FileSystemFileHandle {
  getFile(): Promise<File>;
  createWritable(): Promise<FileSystemWritableFileStream>;
  readonly name: string;
}

interface Window {
  showSaveFilePicker?: (
    options?: SaveFilePickerOptions,
  ) => Promise<FileSystemFileHandle>;
  showOpenFilePicker?: (
    options?: OpenFilePickerOptions,
  ) => Promise<FileSystemFileHandle[]>;
}
