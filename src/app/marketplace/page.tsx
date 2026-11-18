import {redirect} from 'next/navigation';
/** Legacy marketplace URL retained for bookmarks; the upgraded discovery page is canonical. */
export default function MarketplaceRedirect(){redirect('/');}
