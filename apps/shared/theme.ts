/** Shared visual foundation for the four Nexx EventPass native applications.
 * Keep this file framework-neutral so every Expo role app can import it.
 * Accessibility: body text on dark surfaces must remain high-contrast.
 */
export const colors = {
  background: '#0B1020',
  surface: '#151D32',
  surfaceRaised: '#202B44',
  border: '#34425B',
  primary: '#57E3D0',
  primaryPressed: '#35BDAA',
  secondary: '#A78BFA',
  text: '#F8FAFC',
  textMuted: '#B6C3D7',
  success: '#54D6A0',
  warning: '#F8C66D',
  danger: '#FF818D',
  white: '#FFFFFF',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 18, xl: 24, pill: 999 } as const;
export const typography = {
  caption: { fontSize: 12, lineHeight: 18 },
  body: { fontSize: 15, lineHeight: 23 },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '600' as const },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '800' as const },
  hero: { fontSize: 32, lineHeight: 38, fontWeight: '900' as const },
} as const;

export const stateLabels = {
  loading: 'Loading…',
  empty: 'Nothing here yet',
  retry: 'Try again',
  pending: 'Awaiting approval',
  success: 'Completed',
  denied: 'Access denied',
} as const;
