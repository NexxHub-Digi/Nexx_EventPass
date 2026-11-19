export default function EventPassLoading({ label = 'Opening EventPass', compact = false }: { label?:string; compact?:boolean }) {
 return <div className={compact?'ep-loading ep-loading-inline':'ep-loading'} role="status" aria-live="polite">
  <div className="ep-loading-mark" aria-hidden="true">◈</div>
  <div><strong>Nexx <span>EventPass</span></strong><p>{label}…</p></div>
  <div className="ep-loading-track" aria-hidden="true"><i/></div>
 </div>;
}
