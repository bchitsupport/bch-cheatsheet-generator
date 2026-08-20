import type { Metadata } from 'next';
import Image from 'next/image';
import Sidebar from '@/components/Sidebar';
import { NETWORK_ONLY_ACCESS } from '@/auth';
import './globals.css';

/**
 * Rendered per request, not prerendered.
 *
 * The access-control banner below depends on an environment variable read at
 * runtime. Statically prerendered, the layout bakes in whatever that variable
 * was during `npm run build` — which is nothing — and the banner never appears
 * however the server is configured. A safety indicator that silently fails to
 * show is worse than none, and nothing here benefits from being static.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'BCH Cheat Sheet Generator',
  description:
    'Generate BCH Mechanical cheat sheets from construction specification PDFs.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // suppressHydrationWarning goes on <html> and <body> only. Browser extensions
  // stamp attributes onto these two elements before React hydrates — Trancy adds
  // trancy-version, Grammarly and password managers do similar — and React
  // reports that as a hydration mismatch the app has no way to prevent.
  //
  // Deliberately not applied further down the tree: the flag covers only these
  // elements' own attributes, not their children, so a genuine hydration bug in
  // the app still surfaces.
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className="min-h-screen bg-bch-bg text-bch-ink antialiased"
        suppressHydrationWarning
      >
        <div className="flex h-screen flex-col">
          {/*
            Running with the network as the only access control is a deliberate
            choice, and one a user should be able to see rather than have to read
            the configuration to discover. It also tells anyone who reaches this
            from outside the office that they are somewhere they should not be.
          */}
          {NETWORK_ONLY_ACCESS && (
            <div className="shrink-0 bg-amber-100 px-6 py-1.5 text-center text-[11px] text-amber-900">
              Internal tool — no sign-in. Anyone on the BCH network can use this, and
              uploaded specifications stay on the BCH network.
            </div>
          )}
          <header className="flex h-[64px] shrink-0 items-center justify-between border-b border-bch-line bg-white px-6">
            <div>
              <div className="text-lg font-bold tracking-tight text-bch-navy">
                BCH MECHANICAL, L.L.C.
              </div>
              <div className="text-[11px] text-bch-muted">
                Cheat Sheet Generator
              </div>
            </div>
            <Image
              src="/bch-logo.svg"
              alt="BCH Mechanical"
              width={140}
              height={56}
              priority
            />
          </header>

          <div className="flex min-h-0 flex-1">
            <Sidebar />
            <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
