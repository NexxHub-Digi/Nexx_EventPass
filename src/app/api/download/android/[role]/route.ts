import {androidPreviewBuilds,isDownloadRole} from '@/lib/mobile-downloads';

export const dynamic='force-dynamic';

export async function GET(
  _request:Request,
  {params}:{params:Promise<{role:string}>}
){
  const {role}=await params;
  if(!isDownloadRole(role)){
    return new Response('Unknown EventPass app.',{status:404,headers:{'Cache-Control':'no-store'}});
  }
  const build=androidPreviewBuilds[role];
  if(Date.now()>=Date.parse(build.expiresAt)){
    return new Response('This Android preview has expired. A new app build is required.',{
      status:410,headers:{'Cache-Control':'no-store','Content-Type':'text/plain; charset=utf-8'}
    });
  }
  // Only release-verified Expo APK URLs are used; never accept a URL from query parameters.
  return new Response(null,{
    status:307,
    headers:{Location:build.url,'Cache-Control':'private, no-store'}
  });
}
