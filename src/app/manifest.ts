import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Nexx EventPass',
    short_name: 'EventPass',
    description: 'Discover events, book tickets and verify secure QR entry with Nexx EventPass.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#0B1020',
    theme_color: '#0B1020',
    orientation: 'any',
    lang: 'en',
    prefer_related_applications: false,
    icons: [
      { src: '/api/pwa-icon/192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/api/pwa-icon/512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/api/pwa-icon/512', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ]
  };
}
