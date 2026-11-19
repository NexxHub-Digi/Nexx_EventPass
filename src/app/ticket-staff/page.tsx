import Link from 'next/link';
import { redirect } from 'next/navigation';
import OfflineTicketManager from '@/components/OfflineTicketManager';
import { currentUser } from '@/lib/security';

export default async function TicketStaffPage() {
  const user = await currentUser();
  if (!user) redirect('/login/user');
  return (
    <main className="rw-shell">
      <header className="rw-panel">
        <Link href="/dashboard/user">Back to User Portal</Link>
        <h1>Ticket Staff</h1>
        <p>Work with tickets for the events assigned to your account.</p>
      </header>
      <OfflineTicketManager events={[]} />
    </main>
  );
}
