/** Verified finished Expo EAS internal Android APKs (20 Nov 2026).
 * These binaries connect to the isolated staging API. URLs are temporary; do not
 * expose expired builds as downloadable applications. Each role has its own APK.
 * Replace an entry only after verifying the next successful EAS Android build.
 */
export type DownloadRole='user'|'organiser'|'gate'|'platform-admin';

type AndroidPreviewBuild={
  version:string;
  url:string;
  expiresAt:string;
  buildId:string;
};

export const androidPreviewBuilds:Record<DownloadRole,AndroidPreviewBuild>={
  user:{
    version:'0.3.0',
    url:'https://expo.dev/artifacts/eas/ST4xLQ_edFADPvYFif6fsapPW1q7YXokAUrAyfBz8ao.apk',
    expiresAt:'2026-12-03T20:34:19.777Z',
    buildId:'b1e8a570-bf95-4581-b1ab-002b016ab559'
  },
  organiser:{
    version:'0.3.0',
    url:'https://expo.dev/artifacts/eas/oXYrGPbGxh-xA2p9FOITdqVz-nBu7AVfN3pLLSzu9bo.apk',
    expiresAt:'2026-12-03T20:01:48.355Z',
    buildId:'7e962b38-799b-4d55-ac57-b0a4b6cc7caa'
  },
  gate:{
    version:'0.3.0',
    url:'https://expo.dev/artifacts/eas/lS9Ovbst-E9ew-C60qgRFqxl2m6HGfUOriCGsoP2ZOo.apk',
    expiresAt:'2026-12-03T20:46:25.514Z',
    buildId:'4b740948-81d8-4cf1-ae60-1c7c40a81d5f'
  },
  'platform-admin':{
    version:'0.3.0',
    url:'https://expo.dev/artifacts/eas/9xYHaQ6SaCC7FXyly57y1Gk41880EfdZxrkP1O0vJSs.apk',
    expiresAt:'2026-12-03T20:01:57.275Z',
    buildId:'ddafeb45-722e-464a-b90c-616fd7cd7bf7'
  }
};

export function isDownloadRole(value:string):value is DownloadRole{
  return Object.prototype.hasOwnProperty.call(androidPreviewBuilds,value);
}
