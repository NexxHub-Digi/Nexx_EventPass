import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Nexx EventPass - Events Made Simple. Entry Made Secure.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  // Text is intentionally ASCII-only. Next/OG may attempt to dynamically download
  // fallback fonts for decorative Unicode glyphs (and fail at request time).
  return new ImageResponse(
    <div style={{
      display:'flex',width:'100%',height:'100%',padding:84,alignItems:'center',
      background:'linear-gradient(135deg,#0B1020 0%,#25204D 68%,#402774 100%)',
      color:'#F8FAFF',fontFamily:'Arial, sans-serif'
    }}>
      <div style={{display:'flex',flexDirection:'column',gap:20,maxWidth:970}}>
        <div style={{display:'flex',alignItems:'center',fontSize:34,fontWeight:800,color:'#45D6C9'}}>
          <div style={{width:22,height:22,border:'4px solid #45D6C9',transform:'rotate(45deg)',marginRight:22}} />
          NEXX EVENTPASS
        </div>
        <div style={{display:'flex',fontSize:72,fontWeight:800,lineHeight:1.12}}>Events Made Simple.</div>
        <div style={{display:'flex',fontSize:72,fontWeight:800,lineHeight:1.12,color:'#45D6C9'}}>Entry Made Secure.</div>
        <div style={{display:'flex',fontSize:23,color:'#CAD4E8',marginTop:16}}>CREATE / TICKET / VERIFY / ACCESS</div>
      </div>
    </div>, size
  );
}
