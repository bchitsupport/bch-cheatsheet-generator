'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/', label: 'New Sheet', icon: '📄' },
  { href: '/past-jobs', label: 'Past Jobs', icon: '📁' },
  { href: '/how-to-use', label: 'How to Use', icon: '📖' },
  { href: '/about', label: 'About', icon: 'ℹ️' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <nav className="flex h-full w-[200px] shrink-0 flex-col bg-bch-navy text-white">
      <div className="px-4 py-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-200">
          Cheat Sheet
        </div>
        <div className="text-lg font-bold leading-tight">Generator</div>
      </div>

      <ul className="flex-1 space-y-1 px-2">
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm transition ${
                  active
                    ? 'bg-bch-navy-light font-semibold text-white'
                    : 'text-blue-100 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span aria-hidden="true" className="text-base leading-none">
                  {item.icon}
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="border-t border-white/15 px-4 py-4 text-[10px] leading-relaxed text-blue-200">
        Field reference only.
        <br />
        Verify against full spec &amp; drawings.
      </div>
    </nav>
  );
}
