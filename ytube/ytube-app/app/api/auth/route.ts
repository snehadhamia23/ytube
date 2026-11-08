import { env } from "cloudflare:workers";
import { clock, database, newId, response } from "../../../lib/server";
import { cookieToken, equalHash, passwordHash, randomToken, sessionCookie, SESSION_AGE_SECONDS, sha256Hex } from "../../../lib/local-auth";

export const runtime="edge";
const jsonHeaders={"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"};
type Account={id:string;email:string;name:string;password_hash:string;password_salt:string};
const emailFormat=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const text=(value:unknown)=>typeof value==="string"?value:"";

async function session(request:Request,userId:string) {
  const token=randomToken();
  const now=clock();
  await database().prepare("INSERT INTO local_sessions (token_hash,user_id,created_at,expires_at) VALUES (?,?,?,?)")
    .bind(await sha256Hex(token),userId,now,now+SESSION_AGE_SECONDS*1000).run();
  return Response.json({ok:true},{headers:{...jsonHeaders,"Set-Cookie":sessionCookie(request,token)}});
}

export async function POST(request:Request) {
  if(!request.headers.get("content-type")?.startsWith("application/json"))return response({error:"Use JSON."},415);
  let input:Record<string,unknown>;
  try{input=await request.json() as Record<string,unknown>;}catch{return response({error:"Invalid request."},400);}
  const action=text(input.action),email=text(input.email).trim().toLowerCase(),password=text(input.password);
  if(!emailFormat.test(email)||email.length>254||password.length<10||password.length>128)return response({error:"Enter a valid email and a password of 10–128 characters."},422);
  const db=database(),now=clock();
  if(action==="register") {
    if(env.YTUBE_REGISTRATION_OPEN==="0")return response({error:"Registration is closed on this server."},403);
    const name=text(input.name).trim();
    if(name.length<2||name.length>60)return response({error:"Enter a name of 2–60 characters."},422);
    const id=newId(),salt=randomToken(16),hash=await passwordHash(password,salt);
    try{await db.prepare("INSERT INTO local_accounts (id,email,name,password_hash,password_salt,created_at) VALUES (?,?,?,?,?,?)")
      .bind(id,email,name,hash,salt,now).run();}
    catch{return response({error:"An account with this email already exists."},409);}
    return session(request,id);
  }
  if(action==="login") {
    const attempts=await db.prepare("SELECT COUNT(*) AS n FROM auth_attempts WHERE email=? AND outcome='failed' AND created_at>?")
      .bind(email,now-15*60_000).first<{n:number}>();
    if(Number(attempts?.n||0)>=10)return response({error:"Too many sign-in attempts. Try again in 15 minutes."},429);
    const account=await db.prepare("SELECT * FROM local_accounts WHERE email=?").bind(email).first<Account>();
    const computed=await passwordHash(password,account?.password_salt||"unknown-account-salt");
    if(!account||!equalHash(computed,account.password_hash)) {
      await db.prepare("INSERT INTO auth_attempts (id,email,created_at,outcome) VALUES (?,?,?,'failed')").bind(newId(),email,now).run();
      return response({error:"Email or password is incorrect."},401);
    }
    await db.prepare("DELETE FROM auth_attempts WHERE email=?").bind(email).run();
    await db.prepare("DELETE FROM local_sessions WHERE expires_at<?").bind(now).run();
    return session(request,account.id);
  }
  return response({error:"Unknown action."},400);
}

export async function GET(request:Request) {
  const token=cookieToken(request.headers.get("cookie"));
  if(token)await database().prepare("DELETE FROM local_sessions WHERE token_hash=?").bind(await sha256Hex(token)).run();
  return new Response(null,{status:303,headers:{"Location":"/","Set-Cookie":sessionCookie(request,"",0),...jsonHeaders}});
}
