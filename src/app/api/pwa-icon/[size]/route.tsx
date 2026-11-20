import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ size: string }> }
) {
  const { size: requestedSize } = await params;
  if (requestedSize !== '192' && requestedSize !== '512') {
    return new Response('Icon size not found', { status: 404 });
  }

  const size = Number(requestedSize);
  const scale = (n: number) => Math.max(1, Math.round((n * size) / 1024));

  // Uses the same turquoise, violet and navy N-mark as the existing brand SVG.
  // This route emits a real PNG; Chromium's Android installer can consume both sizes.
  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        position: 'relative',
        width: size,
        height: size,
        overflow: 'hidden',
        borderRadius: scale(220),
        background: '#0B1020'
      }}
    >
      <div style={{ position: 'absolute', left: scale(216), top: scale(222),
        width: scale(155), height: scale(572), borderRadius: scale(52),
        background: '#45D6C9' }} />
      <div style={{ position: 'absolute', left: scale(648), top: scale(225),
        width: scale(162), height: scale(572), borderRadius: scale(53),
        background: '#8B5CF6' }} />
      <div style={{ position: 'absolute', left: scale(426), top: scale(205),
        width: scale(155), height: scale(628), borderRadius: scale(20),
        transform: 'rotate(-30deg)',
        background: 'linear-gradient(180deg, #49BDE3, #8B5CF6)' }} />
      {[360, 438, 516, 594, 672].map((y) => (
        <div key={y} style={{ position: 'absolute', left: scale(258), top: scale(y - 11),
          width: scale(22), height: scale(22), borderRadius: scale(11),
          background: '#0B1020' }} />
      ))}
      <div style={{ position: 'absolute', left: scale(782), top: scale(184),
        width: scale(109), height: scale(109),
        borderTopWidth: scale(20), borderTopStyle: 'solid', borderTopColor: '#45D6C9',
        borderRightWidth: scale(20), borderRightStyle: 'solid', borderRightColor: '#45D6C9',
        borderTopRightRadius: scale(8) }} />
    </div>,
    {
      width: size,
      height: size,
      headers: { 'Cache-Control': 'public, max-age=604800' }
    }
  );
}
