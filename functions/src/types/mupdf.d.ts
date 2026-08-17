/**
 * Minimal ambient types for the `mupdf` package, covering only the API
 * surface this project uses. The published package is ESM-only ("type":
 * "module" with an `exports` map and no `main`/root `.d.ts`), which
 * `moduleResolution: "node"` (required elsewhere in this project) cannot
 * resolve - even for type-only imports. Declaring the module ourselves
 * sidesteps that resolution failure without changing module resolution
 * project-wide.
 */
declare module "mupdf" {
  export class Buffer {
    asUint8Array(): Uint8Array;
  }

  export class PDFWidget {
    getName(): string;
    getFieldType(): string;
    getLabel(): string;
    getValue(): string;
    setTextValue(value: string): number;
    toggle(): number;
  }

  export class PDFPage {
    getWidgets(): PDFWidget[];
  }

  export class PDFDocument {
    countPages(): number;
    loadPage(index: number): PDFPage;
    saveToBuffer(options?: string | Record<string, unknown>): Buffer;
  }

  export class Document {
    static openDocument(from: Uint8Array | string, magic?: string): Document;
  }
}
