'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bot, Dumbbell, LayoutDashboard, LineChart, User } from 'lucide-react';
import { useHydrated, useStore } from '@/lib/store';

const TABS = [
  { href: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { href: '/coach', label: 'Coach IA', Icon: Bot },
  { href: '/workout', label: 'Séance', Icon: Dumbbell },
  { href: '/analytics', label: 'Progression', Icon: LineChart },
  { href: '/profile', label: 'Profil', Icon: User },
];

export default function BottomNav() {
  const pathname = usePathname();
  const hydrated = useHydrated();
  const hasActive = useStore((s) => s.active !== null);

  if (pathname.startsWith('/login')) return null;

  return (
    <nav
      aria-label="Navigation principale"
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 backdrop-blur"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-between px-2">
        {TABS.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          const live = href === '/workout' && hydrated && hasActive;
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition ${
                  active ? 'text-lime' : 'text-muted'
                }`}
              >
                <Icon size={22} strokeWidth={active ? 2.5 : 2} />
                {label}
                {live && <span className="absolute right-[28%] top-1.5 h-2 w-2 rounded-full bg-violet" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
