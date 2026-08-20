export const metadata = {
  title: 'How to Use · BCH Cheat Sheet Generator',
};

const WALKTHROUGH = [
  {
    title: 'Get the specifications',
    body: 'Whatever form they arrive in. A whole project manual as one PDF, a division on its own, a folder of individual sections, or a mix — all work. Nothing needs renaming and nothing needs splitting up first: the tool reads the section number off each page.',
  },
  {
    title: 'Fill in the project info',
    body: 'Project name and preparer name are required; they go in the banner. The rest is optional — sub-line, your title and email, and the drawing the abbreviations come from. Leave the legend drawing blank and the sheet says "see contract drawings for legend" rather than inventing one.',
  },
  {
    title: 'Drop the PDFs in and scan',
    body: 'Scanning reads what is in the upload without generating anything. It takes a couple of minutes and costs a few cents.',
  },
  {
    title: 'Check what it found',
    body: 'You get every section it identified, its page range, a line on what it actually contains, and which sheets it feeds. Trades that are not in the upload are marked "not detected" and left unticked. Read this before building — a section in the wrong place is cheap to see here and expensive to find in a finished sheet.',
  },
  {
    title: 'Choose the sheets, then build',
    body: 'Tick the trades you want. The cost is shown before you commit. Sections outside Divisions 22 and 23 that relate to the work are listed separately with a price each, so you can have the fire alarm section read properly for a few cents if it matters on your job.',
  },
  {
    title: 'Read the discrepancy log first',
    body: 'Every sheet comes with one, sorted with the worst first. The high-severity entries are the ones that change what gets bought or built. Read those before pricing or releasing anything from the sheet.',
  },
];

const TROUBLE = [
  {
    q: 'Pages contain no extractable text',
    a: 'Those pages are scans — an image with no text behind it. Whatever is on them will not reach the sheet, and the tool names the page numbers so you know which. Run OCR (Acrobat → Scan & OCR → Recognize Text) and upload again.',
  },
  {
    q: 'A trade you expected is marked "not detected"',
    a: 'The tool needs a few sections that belong to that trade specifically before it will call it present. If you know the scope exists, tick it anyway and build — the detection is a default, not a lock. If it really is absent, the specification for it was not in what you uploaded, and the checklist will say so.',
  },
  {
    q: 'The split warns that page ranges were inferred',
    a: 'Most specification books stamp every page with its section number and the split is exact. A few do not, and boundaries then come from the "SECTION ..." lines instead. Check the page ranges on the review screen before building.',
  },
  {
    q: 'A section looks like it absorbed its neighbour',
    a: 'Where a book states its own section length, that is checked against what was detected and flagged if the two disagree. It has caught a 106-page section swallowed by the one before it, and a spec from an entirely different project bound into a book by mistake. Worth telling whoever assembled the set.',
  },
];

export default function HowToUsePage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-bch-navy">How to Use</h1>
        <p className="mt-1 text-sm text-bch-muted">
          Upload whatever specifications you have. The tool works out what is in them.
        </p>
      </header>

      <div className="space-y-8">
        <section className="card p-5">
          <h2 className="text-sm font-bold text-bch-navy">What to upload</h2>
          <p className="mt-2 text-sm leading-relaxed">
            There is no list of required sections and no division to pick. Give it what
            the office sent — a bound manual, one division, a folder of sections — and it
            reads the section number off each page to work out what it has.
          </p>
          <p className="mt-3 text-sm leading-relaxed">
            More is safe. On a full project manual it reads Divisions 22 and 23 and
            ignores the carpet and the lighting, so uploading everything costs the same as
            uploading only the mechanical divisions. Sections outside those two that bear
            on mechanical work — sprinkler, fire alarm interlocks, firestopping — are
            listed on the review screen so you can have any of them read in full.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-bch-muted">
            Specifications only. Drawings are not read, so anything carried on a drawing
            or a schedule is reported as missing rather than guessed at.
          </p>
        </section>

        <section className="card p-5">
          <h2 className="text-sm font-bold text-bch-navy">Step by step</h2>
          <ol className="mt-4 space-y-5">
            {WALKTHROUGH.map((step, i) => (
              <li key={step.title} className="flex gap-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-bch-navy text-xs font-bold text-white">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{step.title}</div>
                  <p className="mt-1 text-sm leading-relaxed text-bch-muted">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="card p-5">
          <h2 className="text-sm font-bold text-bch-navy">How long it takes</h2>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed">
            <li>
              <b>Scanning</b> — a couple of minutes, a few cents. Nothing is generated.
            </li>
            <li>
              <b>Building</b> — 15 to 25 minutes for one division, longer for several
              sheets at once. Each section is read on its own, which is what takes the
              time and what makes the sheets thorough.
            </li>
          </ul>
          <p className="mt-3 text-sm leading-relaxed text-bch-muted">
            Leave the tab open while it runs. The progress panel shows which section it is
            on and what the reading has cost so far.
          </p>
        </section>

        <section className="card border-amber-200 bg-amber-50 p-5">
          <h2 className="text-sm font-bold text-amber-900">If something looks wrong</h2>
          <dl className="mt-3 space-y-4">
            {TROUBLE.map((t) => (
              <div key={t.q}>
                <dt className="text-sm font-semibold text-amber-900">{t.q}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-amber-900">{t.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="card border-red-200 bg-red-50 p-5">
          <h2 className="text-sm font-bold text-red-800">Before you pass a sheet on</h2>
          <p className="mt-2 text-sm leading-relaxed text-red-900">
            Read the discrepancy log. A sheet is only as trustworthy as the log that came
            with it, and the high-severity entries are the ones that cost money if they
            are wrong. The sheet does not replace the specification or the drawings —
            verify against both.
          </p>
        </section>
      </div>
    </div>
  );
}
