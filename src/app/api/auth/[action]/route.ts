import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { currentUser, issueSession } from '@/lib/security';
import { fail, handleError, ok, payload, str } from '@/lib/http';
export const runtime = 'nodejs';
type Context = { params: Promise<{ action: string }> };
export async function GET(_req: NextRequest, ctx: Context) {
  const { action } = await ctx.params;
  if (action !== 'me') return fail('Not found', 404);
  const user = await currentUser();
  if (!user) return ok({user:null,portals:['user']});
  const permitted = await db()`select exists(select 1 from gate_assignments where user_id=${user.id}) or exists(select 1 from events where organiser_id=${user.id}) as gate_access`;
  const portals = ['user', ...(['organiser','platform_admin'].includes(user.role)?['organiser']:[]), ...(permitted[0]?.gate_access?['gate']:[]), ...(user.role==='platform_admin'?['platform_admin']:[])];
  return ok({user,portals});
}
export async function POST(req: NextRequest, ctx: Context) {
  const { action } = await ctx.params;
  if (action === 'logout') { const response = ok({ success: true }); response.cookies.delete('eventpass_session'); return response; }
  if (!['login', 'register'].includes(action)) return fail('Not found', 404);
  try {
    const body = await payload(req);
    const email = str(body.email, 254).toLowerCase();
    const password = typeof body.password === 'string' ? body.password : '';
    const portal = str(body.portal, 40) || 'user';
    if (!['user','organiser','gate','platform_admin'].includes(portal)) return fail('Invalid sign-in portal');
    if (action === 'register' && !['user','organiser'].includes(portal)) return fail('Staff and administrator accounts cannot self-register',403);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 10 || password.length > 128) return fail('Valid email and password of at least 10 characters required');
    let user;
    if (action === 'register') {
      const name = str(body.fullName, 100);
      if (name.length < 2) return fail('Full name required');
      const provided = str(body.organiserCode, 200);
      const invite = process.env.ORGANISER_INVITE_CODE;
      if (portal === 'organiser' && (!invite || invite.length < 16 || provided !== invite)) return fail('Valid organiser invitation required',403);
      if (portal === 'user' && provided) return fail('Organiser invitation is only accepted in the organiser registration portal');
      const role = portal === 'organiser' ? 'organiser' : 'user';
      const hash = await bcrypt.hash(password, 12);
      const found = await db()`insert into app_users (email, password_hash, full_name, role) values (${email},${hash},${name},${role}) on conflict(email) do nothing returning id,email,full_name,role`;
      if (!found[0]) return fail('Account already exists', 409);
      user = found[0];
    } else {
      const found = await db()`select id,email,full_name,role,password_hash from app_users where email=${email} limit 1`;
      if (!found[0] || !(await bcrypt.compare(password, found[0].password_hash))) return fail('Invalid credentials', 401);
      user = found[0];
    }
    if (portal === 'organiser' && !['organiser','platform_admin'].includes(user.role)) return fail('Organiser account required for this portal',403);
    if (portal === 'platform_admin' && user.role !== 'platform_admin') return fail('Platform administrator access required',403);
    if (portal === 'gate') {
      const assigned = await db()`select exists(select 1 from gate_assignments where user_id=${user.id}) or exists(select 1 from events where organiser_id=${user.id}) as allowed`;
      if (!assigned[0]?.allowed) return fail('Gate access must be assigned by an event organiser',403);
    }
    const token = await issueSession(user.id);
    const response = NextResponse.json({ user: { id:user.id, email:user.email, full_name:user.full_name, role:user.role }, token }, { headers: { 'Cache-Control': 'no-store' } });
    response.cookies.set('eventpass_session', token, { httpOnly:true, secure:process.env.NODE_ENV==='production', sameSite:'lax', path:'/', maxAge:604800 });
    return response;
  } catch (e) { return handleError(e); }
}
