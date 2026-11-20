// Read-only public production smoke tests. No tokens, payment calls or database writes.
const url=process.env.EVENTPASS_BASE_URL;
if(!url)throw new Error('EVENTPASS_BASE_URL is required');
const base=new URL(url);
if(!['https:','http:'].includes(base.protocol))throw new Error('Unsupported smoke-test URL protocol');
if(base.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(base.hostname))throw new Error('Production smoke tests require HTTPS');
base.pathname='/';base.search='';base.hash='';
const root=base.toString().replace(/\/$/,'');
const checks=[
 {path:'/',status:200,contains:'EventPass'},
 ...['user','organiser','gate','platform-admin'].map(role=>({path:'/login/'+role,status:200,contains:'Continue with Google'})),
 {path:'/api/platform/users',status:403},
 {path:'/api/gates',status:403},
 {path:'/api/events',status:200,json:'events'},
 {path:'/api/auth/google/status',status:200,json:'roles'}
];
let errors=0;
for(const check of checks){
 try{
  const resp=await fetch(root+check.path,{redirect:'manual',headers:{'Accept':'application/json, text/html'}});
  const body=await resp.text();
  let passed=resp.status===check.status&&(!check.contains||body.includes(check.contains));
  if(passed&&check.json){
   let json;
   try{json=JSON.parse(body)}catch{json={}};
   passed=check.json==='events'?Array.isArray(json.events):
     ['user','organiser','gate','platform_admin'].every(k=>json.roles?.[k]===true);
  }
  console.log((passed?'PASS':'FAIL')+' '+resp.status+' '+check.path);
  if(!passed){errors++;console.error('Unexpected response for '+check.path+': '+body.slice(0,200));}
 }catch(error){errors++;console.error('ERROR '+check.path+': '+(error instanceof Error?error.message:String(error)))}
}
if(errors){console.error(errors+' smoke test(s) failed');process.exitCode=1}
else console.log('Public read-only EventPass smoke checks all passed');
