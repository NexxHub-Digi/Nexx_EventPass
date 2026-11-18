import PlatformAdminPortal from '@/components/PlatformAdminPortal';
import {requirePortal} from '@/lib/portal-access';
export default async function Page(){
 await requirePortal('platform-admin');
 return <PlatformAdminPortal/>;
}
