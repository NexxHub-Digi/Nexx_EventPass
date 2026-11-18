import GatePortal from '@/components/GatePortal';
import {requirePortal} from '@/lib/portal-access';
export default async function Page(){
 await requirePortal('gate');
 return <GatePortal/>;
}
