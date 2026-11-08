import { clock, clean, database, ensureUser, isAdmin, lang, loadVideos, newId, response, safeUrl, seedDemo, user, videoSelect } from "../../../lib/server";

export const runtime="edge";
const categories=["All","Music","Gaming","Coding","Film","Travel","Food","Learning","News","Sports","Other"];
const reasons=new Set(["spam","harassment","offensive","malicious_link","other"]);
const abusive=/\b(?:fuck|shit|bitch|cunt|nigger|faggot|motherfucker|madarchod|bhenchod|chutiya|puta|mierda|merde|putain)\b/i;
const link=/(?:https?:\/\/|www\.|[a-z0-9-]+\.(?:com|net|org|io|ru|xyz|click|top|info|site|link)(?:\b|\/)|\[[^\]]+\]\([^)]*\))/i;
type Row=Record<string,unknown>;
const value=(x:unknown)=>typeof x==="string"?x:"";
function bodyError(input:unknown) {
  const body=value(input).trim(), folded=clean(body).replace(/[._*\-]+/g,"");
  if(body.length<2||body.length>1200) return "Comments must be 2–1200 characters.";
  if(abusive.test(clean(body))||abusive.test(folded)) return "Please remove abusive language.";
  if(link.test(body)) return "Links are not allowed in comments.";
  if(/(.)\1{9,}/u.test(body)) return "Please avoid repeated characters.";
  const chars=Array.from(body), meaningful=chars.filter(c=>/[\p{L}\p{N}]/u.test(c)).length;
  if(meaningful<2||meaningful/chars.length<.2||/(?:[\p{Extended_Pictographic}\p{S}\p{P}]\s*){12,}/u.test(body)) return "Please add meaningful text.";
  return null;
}
async function video(id:string) {
  return await database().prepare(`${videoSelect} WHERE v.id=? AND v.status='published'`).bind(id).first<Row>();
}
async function ownVideo(id:string,userId:string) {
  return await database().prepare("SELECT v.* FROM videos v JOIN channels ch ON ch.id=v.channel_id WHERE v.id=? AND ch.owner_id=?").bind(id,userId).first<Row>();
}
async function commentsFor(videoId:string,sort:string,userId:string) {
  const order:Record<string,string>={newest:"c.created_at DESC",oldest:"c.created_at ASC",liked:"(likes-dislikes) DESC,c.created_at DESC",relevant:"((likes-dislikes)*4-c.report_count*2+CASE WHEN c.created_at>? THEN 2 ELSE 0 END) DESC,c.created_at DESC"};
  const key=order[sort]?sort:"newest";
  const sql=`SELECT c.*,u.handle,u.name,u.avatar_url,u.location,
  (SELECT COUNT(*) FROM comment_reactions r WHERE r.comment_id=c.id AND r.value=1) AS likes,
  (SELECT COUNT(*) FROM comment_reactions r WHERE r.comment_id=c.id AND r.value=-1) AS dislikes,
  (SELECT value FROM comment_reactions r WHERE r.comment_id=c.id AND r.user_id=?) AS my_reaction
  FROM comments c JOIN users u ON u.id=c.author_id WHERE c.video_id=?
  ORDER BY ${order[key]} LIMIT 300`;
  const binds=key==="relevant"?[userId,videoId,clock()-7*86400000]:[userId,videoId];
  const rows=(await database().prepare(sql).bind(...binds).all()).results;
  return rows.map(row=>({...row,body:row.status==="deleted"?"[Comment deleted by author]":row.status==="hidden"?"[Comment hidden by moderators]":row.body,
    canEdit:row.author_id===userId&&row.status==="visible"&&clock()-Number(row.created_at)<=15*60000}));
}
async function translate(commentId:string,target:string) {
  const row=await database().prepare("SELECT body,language,version,status FROM comments WHERE id=?").bind(commentId).first<{body:string;language:string;version:number;status:string}>();
  if(!row||row.status!=="visible") return response({error:"Comment unavailable."},404);
  if(row.language===target) return response({body:row.body,cached:true});
  const cached=await database().prepare("SELECT body FROM translations WHERE comment_id=? AND version=? AND language=?").bind(commentId,row.version,target).first<{body:string}>();
  if(cached) return response({body:cached.body,cached:true});
  const parts:string[]=[];let chunk="";
  for(const word of row.body.split(/(\s+)/)) {
    if(new TextEncoder().encode(chunk+word).length>450&&chunk){parts.push(chunk);chunk="";}
    if(new TextEncoder().encode(word).length>450) return response({error:"A word in this comment is too long to translate."},422);
    chunk+=word;
  }
  if(chunk)parts.push(chunk);
  try {
    const out:string[]=[];
    for(const part of parts) {
      const url=new URL("https://api.mymemory.translated.net/get");
      url.searchParams.set("q",part);url.searchParams.set("langpair",`${row.language}|${target}`);
      const r=await fetch(url,{signal:AbortSignal.timeout(8000)});
      const d=await r.json() as {responseStatus?:number;responseData?:{translatedText?:string}};
      if(!r.ok||d.responseStatus!==200||!d.responseData?.translatedText) throw new Error();
      out.push(d.responseData.translatedText);
    }
    const body=out.join("");
    await database().prepare("INSERT OR IGNORE INTO translations (comment_id,version,language,body,created_at) VALUES (?,?,?,?,?)").bind(commentId,row.version,target,body,clock()).run();
    return response({body,cached:false});
  } catch {return response({error:"Translation is unavailable right now. The original remains visible."},503);}
}
export async function GET(request:Request) {
  try {
    await seedDemo();
    const identity=await user(),profile=identity?await ensureUser(identity):null;
    const viewerId=identity?.userId||"";
    const url=new URL(request.url),view=url.searchParams.get("view")||"home";
    const db=database();
    if(view==="home"||view==="trending"||view==="search") {
      const category=url.searchParams.get("category")||"All",q=(url.searchParams.get("q")||"").trim().slice(0,80);
      let where="v.status='published'",binds:unknown[]=[];
      if(category!=="All"&&categories.includes(category)){where+=" AND v.category=?";binds.push(category);}
      if(view==="search"&&q){where+=" AND (v.title LIKE ? OR v.description LIKE ? OR v.tags LIKE ? OR ch.name LIKE ?)";binds.push(...Array(4).fill("%"+q+"%"));}
      if(view==="home"&&viewerId) {
        const videos=await loadVideos(where,[...binds,viewerId],"(SELECT COUNT(*) FROM subscriptions s WHERE s.user_id=? AND s.channel_id=v.channel_id) DESC, (v.views + (SELECT COUNT(*) FROM video_reactions r WHERE r.video_id=v.id AND r.value=1)*8) DESC, v.created_at DESC");
        return response({profile,admin:await isAdmin(viewerId),channel:await db.prepare("SELECT * FROM channels WHERE owner_id=?").bind(viewerId).first(),videos,categories});
      }
      const order=view==="trending"?"(v.views + (SELECT COUNT(*) FROM video_reactions r WHERE r.video_id=v.id AND r.value=1)*10) DESC,v.created_at DESC":"v.created_at DESC";
      return response({profile,admin:viewerId?await isAdmin(viewerId):false,channel:viewerId?await db.prepare("SELECT * FROM channels WHERE owner_id=?").bind(viewerId).first():null,videos:await loadVideos(where,binds,order),categories});
    }
    if(view==="watch") {
      const id=value(url.searchParams.get("id")),item=await video(id);
      if(!item) return response({error:"Video not found."},404);
      const reaction=viewerId?await db.prepare("SELECT value FROM video_reactions WHERE user_id=? AND video_id=?").bind(viewerId,id).first<{value:number}>():null;
      const subscribed=viewerId?await db.prepare("SELECT 1 AS yes FROM subscriptions WHERE user_id=? AND channel_id=?").bind(viewerId,item.channel_id).first():null;
      const later=viewerId?await db.prepare("SELECT 1 AS yes FROM watch_later WHERE user_id=? AND video_id=?").bind(viewerId,id).first():null;
      const recommendations=await loadVideos("v.status='published' AND v.id<>?",[id,item.category],"CASE WHEN v.category=? THEN 1 ELSE 0 END DESC,v.views DESC,v.created_at DESC",10);
      return response({profile,admin:viewerId?await isAdmin(viewerId):false,video:item,reaction:reaction?.value||0,subscribed:!!subscribed,watchLater:!!later,recommendations,comments:await commentsFor(id,url.searchParams.get("sort")||"newest",viewerId)});
    }
    if(view==="channel") {
      const handle=value(url.searchParams.get("handle"));
      const channel=await db.prepare("SELECT ch.*,(SELECT COUNT(*) FROM subscriptions s WHERE s.channel_id=ch.id) AS subscribers FROM channels ch WHERE ch.handle=?").bind(handle).first<Row>();
      if(!channel) return response({error:"Channel not found."},404);
      return response({profile,channel,videos:await loadVideos("v.channel_id=? AND v.status='published'",[channel.id],"v.created_at DESC"),subscribed:viewerId?!!(await db.prepare("SELECT 1 AS yes FROM subscriptions WHERE user_id=? AND channel_id=?").bind(viewerId,channel.id).first()):false});
    }
    if(view==="challenge") {
      if(!identity)return response({error:"Sign in first."},401);
      const a=Math.floor(Math.random()*8)+2,b=Math.floor(Math.random()*8)+2,id=newId();
      await db.prepare("INSERT INTO challenges (id,user_id,answer,expires_at) VALUES (?,?,?,?)").bind(id,viewerId,a+b,clock()+5*60000).run();
      return response({id,question:`What is ${a} + ${b}?`});
    }
    if(!identity)return response({error:"Sign in to use your library."},401);
    if(view==="studio") {
      const channel=await db.prepare("SELECT * FROM channels WHERE owner_id=?").bind(viewerId).first<Row>();
      return response({profile,channel,videos:channel?await loadVideos("v.channel_id=? AND v.status<>'deleted'",[channel.id],"v.created_at DESC"):[]});
    }
    if(view==="library") {
      const type=url.searchParams.get("type")||"history";
      let where="",binds:unknown[]=[viewerId],order="v.created_at DESC";
      if(type==="history"){where="v.status='published' AND v.id IN (SELECT video_id FROM watch_history WHERE user_id=?)";order="(SELECT watched_at FROM watch_history h WHERE h.user_id=? AND h.video_id=v.id) DESC";binds.push(viewerId);}
      else if(type==="liked")where="v.status='published' AND v.id IN (SELECT video_id FROM video_reactions WHERE user_id=? AND value=1)";
      else if(type==="later")where="v.status='published' AND v.id IN (SELECT video_id FROM watch_later WHERE user_id=?)";
      else if(type==="subscriptions")where="v.status='published' AND v.channel_id IN (SELECT channel_id FROM subscriptions WHERE user_id=?)";
      else return response({error:"Invalid library view."},400);
      return response({profile,videos:await loadVideos(where,binds,order)});
    }
    if(view==="playlists") {
      const rows=(await db.prepare("SELECT p.*,(SELECT COUNT(*) FROM playlist_items i WHERE i.playlist_id=p.id) AS video_count FROM playlists p WHERE p.owner_id=? ORDER BY p.updated_at DESC").bind(viewerId).all()).results;
      return response({profile,playlists:rows});
    }
    if(view==="playlist") {
      const playlist=await db.prepare("SELECT * FROM playlists WHERE id=? AND (owner_id=? OR visibility='public')").bind(value(url.searchParams.get("id")),viewerId).first<Row>();
      if(!playlist)return response({error:"Playlist not found."},404);
      return response({profile,playlist,videos:await loadVideos("v.status='published' AND v.id IN (SELECT video_id FROM playlist_items WHERE playlist_id=?)",[playlist.id],"v.created_at DESC")});
    }
    if(view==="moderation") {
      const ownChannel=await db.prepare("SELECT id FROM channels WHERE owner_id=?").bind(viewerId).first();
      if(!ownChannel&&!(await isAdmin(viewerId)))return response({error:"Create a channel to review reports."},403);
      const queue=(await db.prepare(`SELECT c.id,c.video_id,c.body,c.status,c.report_count,c.created_at,u.handle,GROUP_CONCAT(DISTINCT r.reason) AS reasons
      FROM comments c JOIN users u ON u.id=c.author_id JOIN videos v ON v.id=c.video_id JOIN channels ch ON ch.id=v.channel_id LEFT JOIN comment_reports r ON r.comment_id=c.id
      WHERE c.report_count>0 AND (ch.owner_id=? OR ?=1) GROUP BY c.id ORDER BY c.report_count DESC,c.created_at DESC LIMIT 100`).bind(viewerId,(await isAdmin(viewerId))?1:0).all()).results;
      const logs=(await db.prepare("SELECT m.* FROM moderation_actions m JOIN comments c ON c.id=m.comment_id JOIN videos v ON v.id=c.video_id JOIN channels ch ON ch.id=v.channel_id WHERE ch.owner_id=? OR ?=1 ORDER BY m.created_at DESC LIMIT 100").bind(viewerId,(await isAdmin(viewerId))?1:0).all()).results;
      return response({profile,queue,logs});
    }
    return response({error:"Unknown view"},400);
  } catch(e){return response({error:e instanceof Error?e.message:"Request failed"},500);}
}
export async function POST(request:Request) {
  try {
    const identity=await user();
    if(!identity)return response({error:"Sign in to continue."},401);
    await ensureUser(identity);
    const uid=identity.userId,db=database(),data=await request.json() as Record<string,unknown>,action=value(data.action),time=clock();
    if(action==="profile.save") {
      const handle=value(data.handle).trim().toLowerCase(),name=value(data.name).trim(),location=value(data.location).trim(),avatar=safeUrl(data.avatarUrl);
      if(!/^[a-z0-9_]{3,24}$/.test(handle)||name.length<2||name.length>50||location.length>70||(value(data.avatarUrl)&&!avatar))return response({error:"Check your profile details."},422);
      try {await db.prepare("UPDATE users SET handle=?,name=?,location=?,avatar_url=?,language=? WHERE id=?").bind(handle,name,location,avatar,lang(data.language),uid).run();}
      catch{return response({error:"That username is taken."},409);}
      return response({ok:true});
    }
    if(action==="channel.save") {
      const handle=value(data.handle).trim().toLowerCase(),name=value(data.name).trim(),description=value(data.description).trim(),avatar=safeUrl(data.avatarUrl),banner=safeUrl(data.bannerUrl);
      if(!/^[a-z0-9_]{3,24}$/.test(handle)||name.length<2||name.length>70||description.length>1000||(value(data.avatarUrl)&&!avatar)||(value(data.bannerUrl)&&!banner))return response({error:"Check the channel details."},422);
      const existing=await db.prepare("SELECT id FROM channels WHERE owner_id=?").bind(uid).first<{id:string}>();
      try {
        if(existing)await db.prepare("UPDATE channels SET handle=?,name=?,description=?,avatar_url=?,banner_url=?,updated_at=? WHERE id=? AND owner_id=?").bind(handle,name,description,avatar,banner,time,existing.id,uid).run();
        else await db.prepare("INSERT INTO channels (id,owner_id,handle,name,description,avatar_url,banner_url,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(newId(),uid,handle,name,description,avatar,banner,time,time).run();
      }catch{return response({error:"That channel handle is taken."},409);}
      return response({ok:true});
    }
    if(action==="video.create") {
      const channel=await db.prepare("SELECT id FROM channels WHERE owner_id=?").bind(uid).first<{id:string}>();
      if(!channel)return response({error:"Create a channel before uploading."},422);
      const title=value(data.title).trim(),description=value(data.description).trim(),category=value(data.category),tags=value(data.tags).trim();
      if(title.length<3||title.length>120||description.length>5000||tags.length>200||!categories.includes(category)||category==="All")return response({error:"Check the video details."},422);
      const id=newId();
      await db.prepare("INSERT INTO videos (id,channel_id,title,description,category,tags,status,created_at,updated_at) VALUES (?,?,?,?,?,?,'draft',?,?)").bind(id,channel.id,title,description,category,tags,time,time).run();
      return response({ok:true,id});
    }
    if(action==="video.update"||action==="video.publish"||action==="video.delete") {
      const id=value(data.id),item=await ownVideo(id,uid);
      if(!item)return response({error:"Video not found in your channel."},404);
      if(action==="video.delete") {await db.prepare("UPDATE videos SET status='deleted',updated_at=? WHERE id=?").bind(time,id).run();return response({ok:true});}
      if(action==="video.publish") {
        if(!item.media_key)return response({error:"Upload a playable video before publishing."},422);
        await db.prepare("UPDATE videos SET status='published',updated_at=? WHERE id=?").bind(time,id).run();return response({ok:true});
      }
      const title=value(data.title).trim(),description=value(data.description).trim(),category=value(data.category),tags=value(data.tags).trim();
      if(title.length<3||title.length>120||description.length>5000||tags.length>200||!categories.includes(category)||category==="All")return response({error:"Check the video details."},422);
      await db.prepare("UPDATE videos SET title=?,description=?,category=?,tags=?,updated_at=? WHERE id=?").bind(title,description,category,tags,time,id).run();
      return response({ok:true});
    }
    if(action==="video.view") {
      const id=value(data.id),item=await video(id);if(!item)return response({error:"Video unavailable."},404);
      const prior=await db.prepare("SELECT watched_at FROM watch_history WHERE user_id=? AND video_id=?").bind(uid,id).first<{watched_at:number}>();
      await db.prepare("INSERT INTO watch_history (user_id,video_id,progress_seconds,watched_at) VALUES (?,?,?,?) ON CONFLICT(user_id,video_id) DO UPDATE SET progress_seconds=excluded.progress_seconds,watched_at=excluded.watched_at").bind(uid,id,Math.max(0,Math.floor(Number(data.progress)||0)),time).run();
      if(!prior||time-prior.watched_at>30*60000)await db.prepare("UPDATE videos SET views=views+1 WHERE id=?").bind(id).run();
      return response({ok:true});
    }
    if(action==="video.react") {
      const id=value(data.id),item=await video(id),reaction=Number(data.value);
      if(!item||![0,1,-1].includes(reaction))return response({error:"Invalid reaction."},422);
      if(reaction)await db.prepare("INSERT INTO video_reactions (user_id,video_id,value) VALUES (?,?,?) ON CONFLICT(user_id,video_id) DO UPDATE SET value=excluded.value").bind(uid,id,reaction).run();
      else await db.prepare("DELETE FROM video_reactions WHERE user_id=? AND video_id=?").bind(uid,id).run();
      return response({ok:true});
    }
    if(action==="subscribe") {
      const channelId=value(data.channelId),channel=await db.prepare("SELECT id,owner_id FROM channels WHERE id=?").bind(channelId).first<{id:string;owner_id:string}>();
      if(!channel||channel.owner_id===uid)return response({error:"Cannot subscribe to this channel."},422);
      const prior=await db.prepare("SELECT 1 AS yes FROM subscriptions WHERE user_id=? AND channel_id=?").bind(uid,channelId).first();
      if(prior)await db.prepare("DELETE FROM subscriptions WHERE user_id=? AND channel_id=?").bind(uid,channelId).run();
      else await db.prepare("INSERT INTO subscriptions (user_id,channel_id,created_at) VALUES (?,?,?)").bind(uid,channelId,time).run();
      return response({ok:true,subscribed:!prior});
    }
    if(action==="later.toggle") {
      const id=value(data.id),item=await video(id);if(!item)return response({error:"Video unavailable."},404);
      const prior=await db.prepare("SELECT 1 AS yes FROM watch_later WHERE user_id=? AND video_id=?").bind(uid,id).first();
      if(prior)await db.prepare("DELETE FROM watch_later WHERE user_id=? AND video_id=?").bind(uid,id).run();
      else await db.prepare("INSERT INTO watch_later (user_id,video_id,added_at) VALUES (?,?,?)").bind(uid,id,time).run();
      return response({ok:true,saved:!prior});
    }
    if(action==="playlist.create") {
      const title=value(data.title).trim(),description=value(data.description).trim(),visibility=data.visibility==="public"?"public":"private";
      if(title.length<2||title.length>80||description.length>300)return response({error:"Check the playlist details."},422);
      const id=newId();await db.prepare("INSERT INTO playlists (id,owner_id,title,description,visibility,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").bind(id,uid,title,description,visibility,time,time).run();
      return response({ok:true,id});
    }
    if(action==="playlist.delete") {
      const id=value(data.id),playlist=await db.prepare("SELECT id FROM playlists WHERE id=? AND owner_id=?").bind(id,uid).first();
      if(!playlist)return response({error:"Playlist not found."},404);
      await db.batch([db.prepare("DELETE FROM playlist_items WHERE playlist_id=?").bind(id),db.prepare("DELETE FROM playlists WHERE id=? AND owner_id=?").bind(id,uid)]);
      return response({ok:true});
    }
    if(action==="playlist.toggle") {
      const playlistId=value(data.playlistId),videoId=value(data.videoId);
      const playlist=await db.prepare("SELECT id FROM playlists WHERE id=? AND owner_id=?").bind(playlistId,uid).first();
      if(!playlist||!(await video(videoId)))return response({error:"Playlist or video unavailable."},404);
      const prior=await db.prepare("SELECT 1 AS yes FROM playlist_items WHERE playlist_id=? AND video_id=?").bind(playlistId,videoId).first();
      if(prior)await db.prepare("DELETE FROM playlist_items WHERE playlist_id=? AND video_id=?").bind(playlistId,videoId).run();
      else await db.prepare("INSERT INTO playlist_items (playlist_id,video_id,added_at) VALUES (?,?,?)").bind(playlistId,videoId,time).run();
      await db.prepare("UPDATE playlists SET updated_at=? WHERE id=?").bind(time,playlistId).run();
      return response({ok:true,saved:!prior});
    }
    if(action==="comment.translate")return translate(value(data.id),lang(data.target));
    if(action==="comment.create") {
      const videoId=value(data.videoId),item=await video(videoId);
      if(!item)return response({error:"Video unavailable."},404);
      const body=value(data.body).trim(),issue=bodyError(body);
      if(issue){await db.prepare("INSERT INTO post_attempts (id,user_id,created_at,outcome) VALUES (?,?,?,'blocked')").bind(newId(),uid,time).run();return response({error:issue},422);}
      const attempts=await db.prepare("SELECT COUNT(*) AS n FROM post_attempts WHERE user_id=? AND created_at>?").bind(uid,time-60000).first<{n:number}>();
      if(Number(attempts?.n||0)>=6){await db.prepare("INSERT INTO post_attempts (id,user_id,created_at,outcome) VALUES (?,?,?,'rate_limited')").bind(newId(),uid,time).run();return response({error:"Too many attempts. Please wait a minute."},429);}
      const recent=await db.prepare("SELECT COUNT(*) AS n FROM post_attempts WHERE user_id=? AND created_at>?").bind(uid,time-2*60000).first<{n:number}>();
      if(Number(recent?.n||0)>=3){
        const result=await db.prepare("UPDATE challenges SET used_at=? WHERE id=? AND user_id=? AND answer=? AND used_at IS NULL AND expires_at>?").bind(time,value(data.challengeId),uid,Number(data.challengeAnswer),time).run();
        if(!result.meta.changes)return response({error:"Complete the human check to keep posting.",challengeRequired:true},428);
      }
      const parentId=value(data.parentId)||null;
      if(parentId){
        const parent=await db.prepare("SELECT video_id,status FROM comments WHERE id=?").bind(parentId).first<{video_id:string;status:string}>();
        if(!parent||parent.video_id!==videoId||parent.status==="hidden")return response({error:"This thread is unavailable."},422);
      }
      const duplicate=await db.prepare("SELECT id FROM comments WHERE author_id=? AND video_id=? AND normalized_body=? AND created_at>? LIMIT 1").bind(uid,videoId,clean(body),time-86400000).first();
      if(duplicate){await db.prepare("INSERT INTO post_attempts (id,user_id,created_at,outcome) VALUES (?,?,?,'duplicate')").bind(newId(),uid,time).run();return response({error:"You already posted that comment recently."},409);}
      const id=newId(),language=lang(data.language);
      await db.batch([
        db.prepare("INSERT INTO comments (id,video_id,parent_id,author_id,body,normalized_body,language,status,created_at,updated_at,version,report_count) VALUES (?,?,?,?,?,?,?,'visible',?,?,1,0)").bind(id,videoId,parentId,uid,body,clean(body),language,time,time),
        db.prepare("INSERT INTO comment_revisions (id,comment_id,body,language,version,edited_by,created_at) VALUES (?,?,?,?,1,?,?)").bind(newId(),id,body,language,uid,time),
        db.prepare("INSERT INTO post_attempts (id,user_id,created_at,outcome) VALUES (?,?,?,'posted')").bind(newId(),uid,time),
      ]);
      return response({ok:true,id});
    }
    if(action.startsWith("comment.")||action==="moderation.decide") {
      const id=value(data.id),comment=await db.prepare("SELECT * FROM comments WHERE id=?").bind(id).first<Row>();
      if(!comment)return response({error:"Comment not found."},404);
      if(action==="moderation.decide") {
        const channelOwner=await db.prepare("SELECT ch.owner_id FROM videos v JOIN channels ch ON ch.id=v.channel_id WHERE v.id=?").bind(comment.video_id).first<{owner_id:string}>();
        if(channelOwner?.owner_id!==uid&&!(await isAdmin(uid)))return response({error:"Forbidden"},403);
        const decision=value(data.decision);if(!["hide","restore","dismiss"].includes(decision))return response({error:"Invalid decision."},422);
        if(decision!=="dismiss")await db.prepare("UPDATE comments SET status=? WHERE id=? AND status!='deleted'").bind(decision==="hide"?"hidden":"visible",id).run();
        await db.prepare("UPDATE comments SET report_count=0 WHERE id=?").bind(id).run();
        await db.prepare("INSERT INTO moderation_actions (id,comment_id,actor_id,action,reason,created_at) VALUES (?,?,?,?,?,?)").bind(newId(),id,uid,decision,"Moderator review",time).run();
        return response({ok:true});
      }
      if(action==="comment.react") {
        if(comment.status!=="visible"||![0,1,-1].includes(Number(data.value)))return response({error:"Invalid reaction."},422);
        const reaction=Number(data.value);
        if(reaction)await db.prepare("INSERT INTO comment_reactions (user_id,comment_id,value) VALUES (?,?,?) ON CONFLICT(user_id,comment_id) DO UPDATE SET value=excluded.value").bind(uid,id,reaction).run();
        else await db.prepare("DELETE FROM comment_reactions WHERE user_id=? AND comment_id=?").bind(uid,id).run();
        return response({ok:true});
      }
      if(action==="comment.report") {
        const reason=value(data.reason);
        if(!reasons.has(reason)||comment.status==="deleted")return response({error:"Choose a valid reason."},422);
        const result=await db.prepare("INSERT OR IGNORE INTO comment_reports (id,comment_id,reporter_id,reason,created_at) VALUES (?,?,?,?,?)").bind(newId(),id,uid,reason,time).run();
        if(!result.meta.changes)return response({error:"You already reported this comment."},409);
        await db.prepare("UPDATE comments SET report_count=report_count+1 WHERE id=?").bind(id).run();
        await db.prepare("INSERT INTO moderation_actions (id,comment_id,actor_id,action,reason,created_at) VALUES (?,?,?,'reported',?,?)").bind(newId(),id,uid,reason,time).run();
        return response({ok:true});
      }
      if(comment.author_id!==uid)return response({error:"You can only change your own comments."},403);
      if(comment.status!=="visible"||time-Number(comment.created_at)>15*60000)return response({error:"The 15-minute edit window has closed."},403);
      if(action==="comment.edit") {
        const body=value(data.body).trim(),issue=bodyError(body),version=Number(data.version);
        if(issue)return response({error:issue},422);
        const result=await db.prepare("UPDATE comments SET body=?,normalized_body=?,language=?,updated_at=?,version=version+1 WHERE id=? AND author_id=? AND status='visible' AND version=? AND created_at>=?").bind(body,clean(body),lang(data.language),time,id,uid,version,time-15*60000).run();
        if(!result.meta.changes)return response({error:"This comment changed elsewhere. Refresh and try again."},409);
        await db.prepare("INSERT INTO comment_revisions (id,comment_id,body,language,version,edited_by,created_at) VALUES (?,?,?,?,?,?,?)").bind(newId(),id,body,lang(data.language),version+1,uid,time).run();
        return response({ok:true});
      }
      if(action==="comment.delete") {
        const result=await db.prepare("UPDATE comments SET body='',status='deleted',updated_at=?,version=version+1 WHERE id=? AND author_id=? AND status='visible' AND version=? AND created_at>=?").bind(time,id,uid,Number(data.version),time-15*60000).run();
        if(!result.meta.changes)return response({error:"This comment changed elsewhere. Refresh and try again."},409);
        await db.prepare("INSERT INTO moderation_actions (id,comment_id,actor_id,action,reason,created_at) VALUES (?,?,?,'author_deleted','Within edit window',?)").bind(newId(),id,uid,time).run();
        return response({ok:true});
      }
    }
    return response({error:"Unknown action."},400);
  }catch(e){return response({error:e instanceof Error?e.message:"Request failed"},500);}
}
