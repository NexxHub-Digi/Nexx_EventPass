import './globals.css';
import './interface-motion.css';
import type { Metadata, Viewport } from 'next';

export const viewport: Viewport = { themeColor: '#0B1020' };

export const metadata: Metadata = {
  metadataBase: new URL('https://nexx-eventpass.vercel.app'),
  title: { default: 'Nexx EventPass', template: '%s | Nexx EventPass' },
  description: 'Create events, manually verify ticket payments and manage secure, single-use QR admission.',
  applicationName: 'Nexx EventPass',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Nexx EventPass' },
  icons: {
    icon: [
      { url: '/brand/eventpass-mark.svg', type: 'image/svg+xml' },
      { url: '/api/pwa-icon/192', type: 'image/png', sizes: '192x192' },
      { url: '/api/pwa-icon/512', type: 'image/png', sizes: '512x512' }
    ],
    apple: [{ url: '/api/pwa-icon/192', sizes: '192x192', type: 'image/png' }]
  },
  openGraph: {
    type: 'website',
    siteName: 'Nexx EventPass',
    title: 'Nexx EventPass — Events Made Simple. Entry Made Secure.',
    description: 'Event ticketing and secure entry verification.'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nexx EventPass',
    description: 'Events Made Simple. Entry Made Secure.'
  }
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
