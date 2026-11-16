import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
export function fail(message: string, status = 400) { return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } }); }
export function ok(data: unknown, status = 200) { return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } }); }
export async function payload(req: Request): Promise<Record<string, unknown>> {
  const body = await req.json();
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid JSON body');
  return body as Record<string, unknown>;
}
export function str(x: unknown, max = 200): string { return typeof x === 'string' ? x.trim().slice(0, max) : ''; }
export function positiveInt(x: unknown, max = 10000) { const n = Number(x); return Number.isInteger(n) && n >= 1 && n <= max ? n : 0; }
export function handleError(e: unknown) { console.error('EventPass request failed:', e instanceof Error ? e.message : 'unknown'); return fail('Request could not be completed', 500); }
