"use client";
import { useState } from "react";
import { LockKeyhole, Play, UserRound } from "lucide-react";

export default function AuthForm({registrationOpen}:{registrationOpen:boolean}) {
  const [mode,setMode]=useState<"login"|"register">("login"),[name,setName]=useState(""),[email,setEmail]=useState(""),[password,setPassword]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
  async function submit(event:React.FormEvent) {
    event.preventDefault();setBusy(true);setError("");
    try{
      const result=await fetch("/api/auth",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:mode,name,email,password})});
      const data=await result.json() as {error?:string};
      if(!result.ok)throw new Error(data.error||"Could not sign in.");
      window.location.assign("/");
    }catch(cause){setError((cause as Error).message);setBusy(false);}
  }
  return <main className="auth-page"><div className="auth-hero"><a className="logo" href="/"><span className="logo-mark"><Play size={16} fill="currentColor"/></span><span>y<span>tube</span></span></a><div><span className="eyebrow">YOUR WORLD, ON PLAY</span><h1>Watch, create, and join the conversation.</h1><p>One place for videos, creators, and a community that speaks your language.</p></div><small>ytube · Self-hosted edition</small></div><div className="auth-panel"><div className="auth-card"><div className="auth-icon">{mode==="login"?<LockKeyhole size={25}/>:<UserRound size={25}/>}</div><span className="modal-eyebrow">WELCOME TO YTUBE</span><h2>{mode==="login"?"Sign in":"Create your account"}</h2><p>{mode==="login"?"Pick up where you left off.":"Start watching and sharing with your own profile."}</p><form onSubmit={submit}>{mode==="register"&&<label>Display name<input required autoComplete="name" minLength={2} maxLength={60} value={name} onChange={e=>setName(e.target.value)} placeholder="Your name"/></label>}<label>Email address<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label><label>Password<input required type="password" minLength={10} maxLength={128} autoComplete={mode==="login"?"current-password":"new-password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 10 characters"/></label>{error&&<div className="auth-error" role="alert">{error}</div>}<button className="accent-button full" disabled={busy}>{busy?"Please wait…":mode==="login"?"Sign in":"Create account"}</button></form>{registrationOpen&&<div className="auth-switch">{mode==="login"?"New to ytube?":"Already have an account?"} <button onClick={()=>{setMode(mode==="login"?"register":"login");setError("");}}>{mode==="login"?"Create an account":"Sign in"}</button></div>}<a className="auth-back" href="/">← Back to videos</a></div></div></main>;
}
