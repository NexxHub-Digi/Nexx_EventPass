import OrganiserPortal from '@/components/OrganiserPortal';
import {requirePortal} from '@/lib/portal-access';
export default async function Page(){
 await requirePortal('organiser');
 return <OrganiserPortal/>;
}
