/**
 * Expandable first-party EventPass ticket design catalogue.
 * Ticket artworks remain presentation only: secure QR payload is always server-issued.
 */
export const ticketThemes=[
 {id:'aurora',name:'Aurora Glow',label:'Festival',gradient:'linear-gradient(135deg,#5928bf 0%,#146b97 55%,#17baa7 100%)',accent:'#b6ffe9'},
 {id:'midnight',name:'Midnight Gold',label:'Premium',gradient:'linear-gradient(135deg,#0c1022 0%,#282242 65%,#68502f 100%)',accent:'#f3cb78'},
 {id:'sunset',name:'Sunset Social',label:'Social',gradient:'linear-gradient(130deg,#a72865 0%,#f56856 70%,#ffae56 100%)',accent:'#ffe9aa'},
 {id:'neon',name:'Neon Pulse',label:'Nightlife',gradient:'linear-gradient(125deg,#101124 0%,#6616b9 55%,#0da19b 100%)',accent:'#a2ffed'},
 {id:'minimal',name:'Minimal Ivory',label:'Corporate',gradient:'linear-gradient(135deg,#253247 0%,#344c61 100%)',accent:'#f4f5f9'},
 {id:'custom',name:'Custom Artwork',label:'Your Design',gradient:'linear-gradient(135deg,#2f2d61 0%,#4d658a 100%)',accent:'#ffffff'}
] as const;
export type TicketThemeId=typeof ticketThemes[number]['id'];
export function findTicketTheme(id:string){return ticketThemes.find(t=>t.id===id)||ticketThemes[0]}
