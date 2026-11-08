import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { cookieToken, sha256Hex } from "./local-auth";
import { demoLibraryVersion, demoVideos, legacyDemoIds } from "./demo-videos";

export const clock = () => Date.now();
export const newId = () => crypto.randomUUID();
export type SiteUser = { userId:string; displayName:string; email:string; fullName:string|null };
export const response = (body: unknown, status=200) => Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
export function database() {
  if (!env.DB) throw new Error("Database binding is unavailable");
  return env.DB;
}
export function mediaBucket() {
  if (!env.BUCKET) throw new Error("Media storage is unavailable");
  return env.BUCKET;
}
export const clean = (value: string) => value.normalize("NFKC").toLocaleLowerCase().replace(/[\u200B-\u200D\uFEFF]/g,"").replace(/\s+/g," ").trim();
export const lang = (value: unknown) => typeof value==="string" && /^[a-z]{2,3}(?:-[A-Za-z]{2,4})?$/.test(value) ? value : "en";
export const safeUrl = (value: unknown) => {
  if (typeof value!=="string" || !value.trim()) return null;
  try { const url=new URL(value); return url.protocol==="https:" && value.length<=500 ? value : null; }
  catch { return null; }
};
export function handleFrom(value: string) {
  return value.normalize("NFKD").toLowerCase().replace(/[^a-z0-9_]/g,"").slice(0,20)||"creator";
}
export async function user():Promise<SiteUser|null> {
  const token=cookieToken((await headers()).get("cookie"));
  if(!token)return null;
  const row=await database().prepare(`SELECT a.id,a.email,a.name FROM local_sessions s
    JOIN local_accounts a ON a.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?`)
    .bind(await sha256Hex(token),clock()).first<{id:string;email:string;name:string}>();
  return row?{userId:row.id,email:row.email,displayName:row.name,fullName:row.name}:null;
}
export async function ensureUser(identity: SiteUser) {
  const db=database(), existing=await db.prepare("SELECT * FROM users WHERE id=?").bind(identity.userId).first();
  if (!existing) {
    const suffix=identity.userId.replace(/[^a-z0-9]/gi,"").slice(-6).toLowerCase();
    const handle=handleFrom(identity.fullName||identity.email.split("@")[0])+"_"+suffix;
    await db.prepare("INSERT OR IGNORE INTO users (id,handle,name,location,language,created_at) VALUES (?,?,?,'','en',?)")
      .bind(identity.userId,handle,identity.fullName||handle,clock()).run();
  }
  return await db.prepare("SELECT * FROM users WHERE id=?").bind(identity.userId).first();
}
export async function isAdmin(userId: string) {
  const row=await database().prepare("SELECT value FROM settings WHERE key='admin_user_id'").first<{value:string}>();
  return row?.value===userId;
}
export async function seedDemo() {
  const db=database();
  const seeded=await db.prepare("SELECT value FROM settings WHERE key='demo_library_version'").first<{value:string}>();
  if (seeded?.value===demoLibraryVersion) return;
  const time=clock()-6*86400000;
  await db.batch([
    db.prepare("INSERT OR IGNORE INTO users (id,handle,name,location,language,created_at) VALUES ('demo-owner','ytube','ytube Originals','','en',?)").bind(time),
    db.prepare("INSERT OR IGNORE INTO channels (id,owner_id,handle,name,description,created_at,updated_at) VALUES ('demo-channel','demo-owner','ytube','ytube Originals','Short videos from Wikimedia Commons for exploring ytube.',?,?)").bind(time,time),
    db.prepare(`UPDATE videos SET status='archived',updated_at=? WHERE id IN (${legacyDemoIds.map(()=>"?").join(",")}) AND sample_url IS NOT NULL`).bind(time,...legacyDemoIds),
    ...demoVideos.map((video,index)=>db.prepare("INSERT OR IGNORE INTO videos (id,channel_id,title,description,category,tags,sample_url,sample_thumb,duration_seconds,status,views,created_at,updated_at) VALUES (?,'demo-channel',?,?,?,?,?,NULL,?,'published',0,?,?)")
      .bind(video.id,video.title,video.description,video.category,video.tags,video.url,video.durationSeconds,time+index*1000,time+index*1000)),
    db.prepare("INSERT OR REPLACE INTO settings (key,value) VALUES ('demo_library_version',?)").bind(demoLibraryVersion),
  ]);
}

export const videoSelect = `SELECT v.*,ch.owner_id AS channel_owner_id,ch.name AS channel_name,ch.handle AS channel_handle,ch.avatar_url AS channel_avatar,
  (SELECT COUNT(*) FROM subscriptions s WHERE s.channel_id=ch.id) AS subscriber_count,
  (SELECT COUNT(*) FROM video_reactions r WHERE r.video_id=v.id AND r.value=1) AS likes,
  (SELECT COUNT(*) FROM video_reactions r WHERE r.video_id=v.id AND r.value=-1) AS dislikes,
  (SELECT COUNT(*) FROM comments c WHERE c.video_id=v.id) AS comment_count
  FROM videos v JOIN channels ch ON ch.id=v.channel_id`;

export async function loadVideos(where: string, binds: unknown[], order: string, limit=60) {
  const query=database().prepare(`${videoSelect} WHERE ${where} ORDER BY ${order} LIMIT ${limit}`);
  return (await query.bind(...binds).all()).results;
}
