export const SESSION_COOKIE="ytube_session";
export const SESSION_AGE_SECONDS=30*24*60*60;
const iterations=210_000;

export function randomToken(bytes=32) {
  const raw=crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...raw)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
}

export async function sha256Hex(value:string) {
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,"0")).join("");
}

export async function passwordHash(password:string,salt:string) {
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]);
  const digest=await crypto.subtle.deriveBits({name:"PBKDF2",salt:new TextEncoder().encode(salt),iterations,hash:"SHA-256"},key,256);
  return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,"0")).join("");
}

export function equalHash(a:string,b:string) {
  if(a.length!==b.length)return false;
  let mismatch=0;
  for(let i=0;i<a.length;i++)mismatch|=a.charCodeAt(i)^b.charCodeAt(i);
  return mismatch===0;
}

export function cookieToken(header:string|null) {
  const match=header?.match(/(?:^|;\s*)ytube_session=([A-Za-z0-9_-]{32,100})(?:;|$)/);
  return match?.[1]||null;
}

export function sessionCookie(request:Request,token:string,maxAge=SESSION_AGE_SECONDS) {
  const secure=new URL(request.url).protocol==="https:"||request.headers.get("x-forwarded-proto")==="https:";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure?"; Secure":""}`;
}
