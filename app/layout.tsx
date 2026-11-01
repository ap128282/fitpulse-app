import type { Metadata, Viewport } from 'next';
import { Manrope } from 'next/font/google';
import './globals.css';
import BottomNav from '@/components/BottomNav';
import SWRegister from '@/components/SWRegister';

const manrope = Manrope({ subsets: ['latin'], display: 'swap' });

export const metadata: Metadata = {
  title: 'FitPulse',
  description: 'Coach de musculation IA : surcharge progressive RIR, séances intelligentes, suivi.',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, title: 'FitPulse', statusBarStyle: 'black-translucent' },
  icons: { icon: '/icon-192.png', apple: '/icon-192.png' },
};

export const viewport: Viewport = {
  themeColor: '#0F0F10',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className={`${manrope.className} min-h-screen bg-bg text-white antialiased`}>
        <main className="mx-auto min-h-screen w-full max-w-md px-4 pb-32 pt-6">{children}</main>
        <BottomNav />
        <SWRegister />
      </body>
    </html>
  );
}
