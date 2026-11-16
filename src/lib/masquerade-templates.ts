/**
 * First-party reusable admission ticket layouts, based on the seven provided
 * STJ Masked Party ticket examples. These are generic design systems:
 * no STJ guest pass/QR, transaction, or artwork is copied to another tenant.
 * The server-generated encrypted ticket QR is rendered separately.
 */
export const masqueradeTemplates=[
 {id:'stj-royal-gold',name:'Royal Gold Masquerade',label:'Luxury Gold',color_a:'#17051e',color_b:'#63217b',accent:'#ffd572',style:'royal'},
 {id:'stj-velvet-crown',name:'Velvet Crown',label:'Velvet & Gold',color_a:'#26042f',color_b:'#7d257e',accent:'#ffdb85',style:'crown'},
 {id:'stj-grand-gala',name:'Grand Gala Admission',label:'Gala Night',color_a:'#27052a',color_b:'#4c1872',accent:'#ffcf6f',style:'gala'},
 {id:'stj-midnight-luxe',name:'Midnight Luxe',label:'Dark Luxury',color_a:'#12031c',color_b:'#3f1263',accent:'#ffdf93',style:'midnight'},
 {id:'stj-gold-script',name:'Gold Script Gala',label:'Classic Elegance',color_a:'#200821',color_b:'#43104b',accent:'#f6d68b',style:'script'}
] as const;
export function isMasqueradeTemplate(id:string){return masqueradeTemplates.some(x=>x.id===id)}
