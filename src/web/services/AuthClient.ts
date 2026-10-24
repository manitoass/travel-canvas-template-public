// Cloudflare Access owns the session; ordinary state-changing requests require
// same-origin context and this custom header. Do not store extra app passwords.
export function mutationHeaders():Record<string,string>{
 return {'Content-Type':'application/json','X-Travel-Canvas-Write':'1'};
}
export async function ownerPost(path:string,body:unknown):Promise<any>{
 const response=await fetch(path,{method:'POST',headers:mutationHeaders(),body:JSON.stringify(body),cache:'no-store'});
 const result=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(result.error||`Request failed (${response.status})`);
 return result;
}
