// Re-export everything from the IndexedDB-backed storage module.
// This file exists for backward compatibility — all consumers should
// import from "../lib/library" (or "../lib/db" directly).

export {
  getLibrary,
  getLibraryItem,
  saveLibraryItem,
  deleteLibraryItem,
  duplicateLibraryItem,
  getCompositions,
  saveComposition,
  deleteComposition,
  generateId,
  exportToFile,
  exportLibraryToFile,
  importFromFile,
  type ExportBundle,
  type ImportResult,
} from "./db";

export type { Composition } from "../types";
