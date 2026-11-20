export type SavedDesign={
 version:number;theme_id:string;mode:'ticket'|'qr'|'both';
 fields:Record<string,string>;enabled:Record<string,boolean>;
};
export type IssuedDesignSnapshot={
 schema:'eventpass.ticket-design.v1';version:number;theme:string;mode:'ticket'|'qr'|'both';
 fields:Record<string,string>;enabled:Record<string,boolean>;ticketCategoryId:string|null;
};
/** Freeze a copy of the chosen event design at issuance, not a reference to an editable draft. */
export function makeIssuedDesignSnapshot(design:SavedDesign|null|undefined,categoryId:string|null):IssuedDesignSnapshot|null{
 if(!design)return null;
 return {schema:'eventpass.ticket-design.v1',version:Number(design.version),theme:String(design.theme_id),
  mode:design.mode,fields:{...design.fields},enabled:{...design.enabled},ticketCategoryId:categoryId};
}
