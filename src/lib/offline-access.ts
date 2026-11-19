import {currentUser} from '@/lib/security';
import {db} from '@/lib/db';
import type {CurrentUser} from '@/lib/security';

export type OfflinePermission = 'view'|'generate'|'activate'|'export'|'distribute'|'sales'|'reports'|'revoke'|'reissue'|'staff';
export const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function offlineAccess(eventId:string,permission:OfflinePermission) {
 const u=await currentUser();
 if(!u||u.account_status!=='active'||!uuid.test(eventId))return null;
 const owner=await db()`select e.id,e.organiser_id,e.status,e.visibility,e.capacity,e.ticket_theme,e.admission_label,e.qr_keyword_ciphertext,e.starts_at
 from events e join app_users a on a.id=e.organiser_id
 where e.id=${eventId} and a.account_status='active' and a.role='organiser'`;
 const event=owner[0];
 if(!event)return null;
 if(u.id===event.organiser_id&&u.role==='organiser')return {user:u,event};
 const allowed=await db()`select 1 from offline_ticket_staff s where s.user_id=${u.id} and s.organiser_id=${event.organiser_id}
 and s.revoked_at is null and (s.expires_at is null or s.expires_at>now())
 and ${permission}=any(s.permissions)
 and (s.scope='all' and (s.include_future or (select created_at from events where id=${eventId})<=s.created_at)
  or s.scope='selected' and ${eventId}::uuid=any(s.selected_event_ids))
 and exists(select 1 from events e where e.id=${eventId} and e.organiser_id=s.organiser_id)
 limit 1`;
 return allowed[0]?{user:u,event}:null;
}
export async function organiserEventIds(u:CurrentUser) {
 if(u.role==='organiser')return db()`select id from events where organiser_id=${u.id}`;
 return db()`select distinct e.id from events e join offline_ticket_staff s on s.organiser_id=e.organiser_id
 where s.user_id=${u.id} and s.revoked_at is null and (s.expires_at is null or s.expires_at>now())
 and ('view'=any(s.permissions) or 'reports'=any(s.permissions))
 and ((s.scope='all' and (s.include_future or e.created_at<=s.created_at))
 or (s.scope='selected' and e.id=any(s.selected_event_ids)))`;
}
