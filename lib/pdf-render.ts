import puppeteer, { type Browser } from 'puppeteer-core';
import { FONT_PATCH } from './template';

/** Vercel / AWS Lambda set these; a laptop does not. */
function isServerless(): boolean {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

const LOCAL_CHROME_CANDIDATES: Record<string, string[]> = {
  win32: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ],
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ],
  linux: [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/microsoft-edge',
  ],
};

async function findLocalChrome(): Promise<string> {
  if (process.env.LOCAL_CHROME_PATH) return process.env.LOCAL_CHROME_PATH;

  const { existsSync } = await import('node:fs');
  for (const candidate of LOCAL_CHROME_CANDIDATES[process.platform] ?? []) {
    if (existsSync(candidate)) return candidate;
  }

  throw new Error(
    'No local Chrome or Edge found for PDF rendering. Install Google Chrome, ' +
      'or set LOCAL_CHROME_PATH in .env.local to a Chromium-based browser executable.',
  );
}

async function launchBrowser(): Promise<Browser> {
  if (isServerless()) {
    const chromium = (await import('@sparticuz/chromium')).default;
    return puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }

  return puppeteer.launch({
    executablePath: await findLocalChrome(),
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
}

/** Drop our font stack in just before </head> (or at the top if there isn't one). */
function injectFonts(html: string): string {
  if (html.includes('</head>')) {
    return html.replace('</head>', `${FONT_PATCH}\n</head>`);
  }
  return `${FONT_PATCH}\n${html}`;
}

export async function renderPdf(html: string): Promise<Buffer> {
  return renderAll([html]).then((pdfs) => pdfs[0]);
}

/**
 * Render several documents in one browser. Launching Chromium is by far the most
 * expensive part of the request — doing it once for the sheet and the checklist
 * saves several seconds and keeps us inside the function timeout.
 */
export async function renderAll(htmls: string[]): Promise<Buffer[]> {
  const browser = await launchBrowser();

  try {
    const out: Buffer[] = [];

    for (const html of htmls) {
      const page = await browser.newPage();
      try {
        // 'load' waits for the Google Fonts stylesheet; fonts.ready then waits for
        // the font files themselves to finish loading and swapping in. Without the
        // second wait the PDF renders in the fallback face and the layout shifts.
        await page.setContent(injectFonts(html), {
          waitUntil: 'load',
          timeout: 30_000,
        });
        await page.evaluateHandle('document.fonts.ready');

        const pdf = await page.pdf({
          format: 'Letter',
          // preferCSSPageSize makes the template's `@page { size: letter;
          // margin: 28.5pt }` authoritative, so these values only apply if a
          // generated document somehow omits the @page rule. Note puppeteer
          // rejects `pt` here — 38px is the same 28.5pt at 96dpi.
          margin: { top: '38px', right: '38px', bottom: '38px', left: '38px' },
          printBackground: true,
          displayHeaderFooter: false,
          preferCSSPageSize: true,
        });
        out.push(Buffer.from(pdf));
      } finally {
        await page.close();
      }
    }

    return out;
  } finally {
    await browser.close();
  }
}
