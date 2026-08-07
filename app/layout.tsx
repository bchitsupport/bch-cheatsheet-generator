import type { Metadata } from 'next';
import Image from 'next/image';
import Sidebar from '@/components/Sidebar';
import './globals.css';

export const metadata: Metadata = {
  title: 'BCH Cheat Sheet Generator',
  description:
    'Generate BCH Mechanical field cheat sheets from construction specification PDFs.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bch-bg text-bch-ink antialiased">
        <div className="flex h-screen flex-col">
          <header className="flex h-[64px] shrink-0 items-center justify-between border-b border-bch-line bg-white px-6">
            <div>
              <div className="text-lg font-bold tracking-tight text-bch-navy">
                BCH MECHANICAL, L.L.C.
              </div>
              <div className="text-[11px] text-bch-muted">
                Field Cheat Sheet Generator
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
