import fs from 'node:fs/promises';
import path from 'node:path';

export const runtime = 'nodejs';

/**
 * Write generated PDFs to disk from the browser. Development only.
 *
 * A build driven through the browser leaves its output in that browser's memory
 * and nowhere else, so a run worth real money is stranded the moment the tab
 * closes. This exists so a browser-driven test can be inspected with the same
 * tools as a command-line one — page fill, fonts, text extraction.
 *
 * Refuses to run in production: it writes files to the server on request, which
 * is not something a deployed instance should ever do.
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return Response.json({ error: 'Not available in production.' }, { status: 404 });
  }

  try {
    const body = (await request.json()) as {
      dir?: string;
      files?: { name: string; base64: string }[];
    };

    const files = Array.isArray(body.files) ? body.files : [];
    if (files.length === 0) throw new Error('No files supplied.');

    // Confine writes to the project's out/ directory whatever is asked for.
    const root = path.join(process.cwd(), 'out');
    const dir = path.join(root, (body.dir ?? 'browser').replace(/[^\w.-]/g, '-'));
    if (!dir.startsWith(root)) throw new Error('Refusing to write outside out/.');
    await fs.mkdir(dir, { recursive: true });

    const written: string[] = [];
    for (const f of files) {
      const name = path.basename(f.name).replace(/[^\w.-]/g, '-');
      const full = path.join(dir, name);
      await fs.writeFile(full, Buffer.from(f.base64, 'base64'));
      written.push(full);
    }

    return Response.json({ written });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Save failed.' },
      { status: 500 },
    );
  }
}
