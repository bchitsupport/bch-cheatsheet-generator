// Full-size Division 23 job against the LIVE deployment.
// Local timings do not transfer directly: Vercel adds cold start and has to
// unpack a ~50MB Chromium binary before the first render. This measures the
// real thing.
import fs from 'node:fs';
import https from 'node:https';

const HOST = 'bch-cheatsheet-generator.vercel.app';
const SECTIONS = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const TARGET = 184_677;

const WANT = [
  '23 31 13', '23 33 00', '23 07 13', '23 37 13', '23 36 00',
  '23 34 23', '23 05 53', '23 51 00', '23 51 23', '23 05 48',
];

const pool = SECTIONS.map((s) => s.text).join('\n\n');
const per = Math.ceil(TARGET / WANT.length);
const files = WANT.map((num, i) => {
  let body = '';
  let cursor = (i * per) % pool.length;
  while (body.length < per) { body += pool.slice(cursor, cursor + (per - body.length)); cursor = 0; }
  return { fileName: `${num}.pdf`, matchedSection: num, text: `SECTION ${num}\n\n${body.slice(0, per)}` };
});

const payload = JSON.stringify({
  division: 'sheetmetal',
  project: {
    projectName: 'Live Duration Probe', projectSub: 'VERCEL TIMING',
    preparerName: 'Joshua Ahwai', preparerTitle: 'Assistant Project Manager Intern',
    preparerEmail: 'joshua.ahwai@bchmechanical.com', legendDrawing: 'AD-M001',
  },
  files,
});

console.log(`POST https://${HOST}/api/generate`);
console.log(`payload: ${files.length} sections, ${files.reduce((n, f) => n + f.text.length, 0).toLocaleString()} chars\n`);

const t0 = Date.now();
const el = () => ((Date.now() - t0) / 1000).toFixed(1);

const req = https.request(
  { host: HOST, path: '/api/generate', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    timeout: 0 },
  (res) => {
    console.log(`[${el()}s] HTTP ${res.statusCode}`);
    let buf = '';
    let done = null;
    let sawFrame = false;
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
      buf += chunk;
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const l of lines) {
        if (!l.trim()) continue;
        sawFrame = true;
        let e; try { e = JSON.parse(l); } catch { console.log(`[${el()}s] raw: ${l.slice(0,120)}`); continue; }
        if (e.type === 'done') { done = e.result; console.log(`[${el()}s] DONE`); }
        else if (e.type === 'error') console.log(`[${el()}s] ERROR ${e.message}`);
        else if (e.type === 'warning') console.log(`[${el()}s] warn: ${String(e.message).slice(0,80)}`);
        else console.log(`[${el()}s] ${e.step}`);
      }
    });
    res.on('end', () => {
      const secs = Number(el());
      console.log(`\nTOTAL ${secs}s  (Vercel Hobby ceiling: 300s)`);
      if (done) {
        fs.writeFileSync(process.argv[3], Buffer.from(done.cheatsheetPdf, 'base64'));
        fs.writeFileSync(process.argv[4], Buffer.from(done.checklistPdf, 'base64'));
        console.log(`pages=${done.pageCount}  discrepancies=${done.discrepancies.length}`);
        console.log(`headroom: ${(300 - secs).toFixed(0)}s`);
        console.log(secs < 260 ? '\nPASS - comfortable' : secs < 300 ? '\nPASS - but tight' : '\nFAIL');
      } else {
        console.log(sawFrame ? '\nFAIL - killed mid-generation' : '\nFAIL - no frames at all');
      }
    });
  },
);
req.setTimeout(0);
req.on('error', (e) => console.log(`[${el()}s] request error: ${e.message}`));
req.write(payload);
req.end();
