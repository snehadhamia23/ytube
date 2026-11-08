"use client";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Flag, Languages, MapPin, MessageCircle, PenLine, Send, Trash2, X } from "lucide-react";
import { Avatar } from "./ui";
import type { Comment, Profile } from "./types";
import { api, formatDateTime, languageName, languages } from "./types";

const reasons=[["spam","Spam or repeated posting"],["harassment","Harassment"],["offensive","Offensive content"],["malicious_link","Suspicious link"],["other","Something else"]];
function RichText({text}:{text:string}){return <>{text.split(/(@[a-z0-9_]{3,24})/gi).map((part,i)=>part.startsWith("@")?<span className="mention" key={i}>{part}</span>:part)}</>;}
export default function Comments({videoId,comments,profile,sort,onSort,refresh,notify}:{videoId:string;comments:Comment[];profile:Profile|null;sort:string;onSort:(value:string)=>void;refresh:()=>Promise<void>;notify:(message:string)=>void}){
  const [body,setBody]=useState(""),[language,setLanguage]=useState(profile?.language||"en"),[replyTo,setReplyTo]=useState<string|null>(null),[busy,setBusy]=useState(false);
  const [editing,setEditing]=useState<string|null>(null),[editBody,setEditBody]=useState(""),[editLanguage,setEditLanguage]=useState("en");
  const [translations,setTranslations]=useState<Record<string,string>>({}),[translating,setTranslating]=useState<string|null>(null);
  const [reportId,setReportId]=useState<string|null>(null),[reportReason,setReportReason]=useState("spam");
  const [challenge,setChallenge]=useState<{id:string;question:string}|null>(null),[answer,setAnswer]=useState("");
  const names=useMemo(()=>Array.from(new Set(comments.map(c=>c.handle).filter(h=>h!==profile?.handle))).slice(0,5),[comments,profile]);
  async function act(payload:Record<string,unknown>,message:string) {
    setBusy(true);try{await api(payload);await refresh();notify(message);return true;}catch(e){if((e as Error&{status?:number}).status===401)window.top?.location.assign("/auth");else notify((e as Error).message);return false;}finally{setBusy(false);}
  }
  async function post(){
    if(!body.trim()||busy)return;
    setBusy(true);
    try{await api({action:"comment.create",videoId,parentId:replyTo,body,language,challengeId:challenge?.id,challengeAnswer:answer});setBody("");setReplyTo(null);setChallenge(null);setAnswer("");await refresh();notify("Comment posted.");}
    catch(e){const error=e as Error&{challengeRequired?:boolean};if(error.challengeRequired){try{const r=await fetch("/api/app?view=challenge");setChallenge(await r.json());setAnswer("");}catch{}}notify(error.message);}
    finally{setBusy(false);}
  }
  async function translate(c:Comment){
    if(translations[c.id]){setTranslations(old=>{const next={...old};delete next[c.id];return next;});return;}
    setTranslating(c.id);try{const result=await api({action:"comment.translate",id:c.id,target:profile?.language||"en"});setTranslations(old=>({...old,[c.id]:result.body}));}
    catch(e){notify((e as Error).message);}finally{setTranslating(null);}
  }
  function card(c:Comment,depth=0):React.ReactNode {
    const replies=comments.filter(x=>x.parent_id===c.id);
    return <div className={depth?"reply-card":"comment-card"} key={c.id}>
      <div className="comment-head"><Avatar name={c.name} url={c.avatar_url} size={37}/><div className="comment-identity"><strong>{c.name}</strong><span>@{c.handle}</span><small>{formatDateTime(c.created_at)}</small>{c.updated_at>c.created_at+1000&&<small>Edited</small>}{c.location&&<small className="comment-location"><MapPin size={11}/>{c.location}</small>}</div><span className="language-pill">{languageName(c.language)}</span></div>
      {editing===c.id?<div className="comment-edit"><textarea maxLength={1200} value={editBody} onChange={e=>setEditBody(e.target.value)}/><div><select value={editLanguage} onChange={e=>setEditLanguage(e.target.value)}>{languages.map(l=><option key={l.code} value={l.code}>{l.name}</option>)}</select><button onClick={()=>setEditing(null)}>Cancel</button><button className="accent-button" disabled={busy} onClick={async()=>{if(await act({action:"comment.edit",id:c.id,body:editBody,language:editLanguage,version:c.version},"Comment updated."))setEditing(null);}}>Save</button></div></div>:<p className={c.status==="visible"?"comment-text":"comment-text tombstone"}><RichText text={translations[c.id]||c.body}/></p>}
      {translations[c.id]&&<div className="translation-note">Translated to {languageName(profile?.language||"en")} · Machine translation may contain errors.</div>}
      {c.status==="visible"&&editing!==c.id&&<div className="comment-actions"><button className={c.my_reaction===1?"on":""} onClick={()=>act({action:"comment.react",id:c.id,value:c.my_reaction===1?0:1},"Reaction saved.")} aria-label="Like comment"><ArrowUp size={15}/>{c.likes||"Like"}</button><button className={c.my_reaction===-1?"on":""} onClick={()=>act({action:"comment.react",id:c.id,value:c.my_reaction===-1?0:-1},"Reaction saved.")} aria-label="Dislike comment"><ArrowDown size={15}/>{c.dislikes||"Dislike"}</button><button onClick={()=>{setReplyTo(c.id);document.getElementById("comment-composer")?.scrollIntoView({behavior:"smooth",block:"center"});}}><MessageCircle size={14}/> Reply</button>{c.language!==(profile?.language||"en")&&<button disabled={translating===c.id} onClick={()=>translate(c)}><Languages size={14}/>{translating===c.id?"Translating…":translations[c.id]?"Original":"Translate"}</button>}{c.canEdit&&<><button onClick={()=>{setEditing(c.id);setEditBody(c.body);setEditLanguage(c.language);}}><PenLine size={13}/> Edit</button><button onClick={()=>{if(confirm("Delete your comment? Replies will remain visible."))act({action:"comment.delete",id:c.id,version:c.version},"Comment deleted.");}}><Trash2 size={13}/> Delete</button></>}<button onClick={()=>{setReportId(c.id);setReportReason("spam");}}><Flag size={13}/> Report</button></div>}
      {replies.length>0&&<div className="comment-replies">{replies.map(r=>card(r,depth+1))}</div>}
    </div>;
  }
  const roots=comments.filter(c=>!c.parent_id);
  return <section className="comments-section" id="comments"><div className="comments-heading"><h2>{comments.length} Comments</h2><select aria-label="Sort comments" value={sort} onChange={e=>onSort(e.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="liked">Most liked</option><option value="relevant">Most relevant</option></select></div>
    {profile?<div className="comment-composer" id="comment-composer"><Avatar name={profile.name} url={profile.avatar_url} size={38}/><div className="composer-content">{replyTo&&<div className="replying">Replying in thread <button onClick={()=>setReplyTo(null)}><X size={13}/> Cancel</button></div>}<textarea value={body} maxLength={1200} placeholder="Add a thoughtful comment…" onChange={e=>setBody(e.target.value)}/><div className="composer-bottom"><div><Languages size={15}/><select value={language} onChange={e=>setLanguage(e.target.value)} aria-label="Comment language">{languages.map(l=><option key={l.code} value={l.code}>{l.name}</option>)}</select><span>{body.length}/1200</span></div><button className="accent-button" disabled={!body.trim()||busy} onClick={post}><Send size={14}/> Comment</button></div>{challenge&&<div className="challenge"><span>{challenge.question}</span><input value={answer} onChange={e=>setAnswer(e.target.value)} inputMode="numeric" aria-label="Human check answer" placeholder="Answer"/></div>}{names.length>0&&<div className="mention-hint">Mention someone: {names.slice(0,3).map(name=><button key={name} onClick={()=>setBody(b=>b+" @"+name+" ")}>@{name}</button>)}</div>}</div></div>:<div className="signin-prompt">Join the conversation. <a href="/auth" target="_top">Sign in to comment</a></div>}
    <div className="comments-list">{roots.length?roots.map(c=>card(c)):<div className="comments-empty">Be the first to start the conversation.</div>}</div>
    {reportId&&<div className="modal-backdrop" onClick={()=>setReportId(null)}><div className="modal-card small-modal" onClick={e=>e.stopPropagation()}><button className="modal-x" onClick={()=>setReportId(null)} aria-label="Close"><X size={18}/></button><span className="modal-eyebrow">COMMUNITY SAFETY</span><h2>Report comment</h2><p>Choose a reason. A moderator will review it; dislikes never remove comments automatically.</p><div className="report-options">{reasons.map(([code,name])=><label key={code}><input type="radio" checked={reportReason===code} onChange={()=>setReportReason(code)}/>{name}</label>)}</div><button className="accent-button full" onClick={async()=>{if(await act({action:"comment.report",id:reportId,reason:reportReason},"Report sent for review."))setReportId(null);}}><Flag size={15}/> Send report</button></div></div>}
  </section>;
}

