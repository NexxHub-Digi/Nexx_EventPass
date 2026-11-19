/** Pure discovery rules shared by native event browsing and Saved Events.
 * Only events eligible for public discovery may appear in either view.
 */
export type DiscoveryEvent={
 id:string;status:string;visibility?:string;title:string;venue:string;
 category?:string;description?:string;price_ngn:number;
};
export type DiscoveryOptions={
 section:'discover'|'saved';category:string;query:string;sortBy:'name'|'price';saved:string[];
};
export function filterDiscoveryEvents<T extends DiscoveryEvent>(events:T[],options:DiscoveryOptions):T[]{
 const search=options.query.trim().toLocaleLowerCase();
 return events.filter(event=>
  event.status==='published'&&event.visibility==='public'&&
  (options.section!=='saved'||options.saved.includes(event.id))&&
  (options.category==='All'||(event.category||'Other')===options.category)&&
  [event.title,event.venue,event.description||''].join(' ').toLocaleLowerCase().includes(search)
 ).sort((a,b)=>options.sortBy==='price'?
  Number(a.price_ngn)-Number(b.price_ngn)||a.title.localeCompare(b.title):
  a.title.localeCompare(b.title));
}
export function toggleSavedEvent(saved:string[],eventId:string):string[]{
 return saved.includes(eventId)?saved.filter(id=>id!==eventId):[...saved,eventId];
}
