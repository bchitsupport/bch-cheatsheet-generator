declare module 'pdf-parse/lib/pdf-parse.js' {
  interface PdfParseResult {
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata: unknown;
    version: string;
    text: string;
  }

  interface PdfParseOptions {
    /** Custom per-page renderer. Return the page's text. */
    pagerender?: (pageData: any) => Promise<string> | string;
    /** Max pages to parse. 0 = all. */
    max?: number;
    version?: string;
  }

  function pdfParse(
    data: Buffer | Uint8Array,
    options?: PdfParseOptions,
  ): Promise<PdfParseResult>;

  export = pdfParse;
}
