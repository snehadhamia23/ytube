"use client";
import { useEffect, useRef, useState } from "react";
import { Maximize, Minimize, Pause, Play, RotateCcw, SkipForward, Volume2, VolumeX } from "lucide-react";
import type { Video } from "./types";
import { formatDate, formatDuration, formatViews } from "./types";
import { demoVideoById } from "../lib/demo-videos";

export function Avatar({name,url,size=38}:{name:string;url?:string|null;size?:number}){
  const [failed,setFailed]=useState(false);
  return <span className="avatar" style={{width:size,height:size,fontSize:size*.34}}>{url&&!failed?<img src={url} alt={name+"'s avatar"} onError={()=>setFailed(true)}/>:name.slice(0,2).toUpperCase()}</span>;
}
export function Thumb({video,className=""}:{video:Video;className?:string}){
  const [failed,setFailed]=useState(false);
  const index=video.sample_thumb??0;
  const imageSrc=video.thumbnail_key?`/api/media/thumbnail/${video.id}`:demoVideoById[video.id]?.posterUrl;
  const spriteStyle={backgroundPosition:`${[0,50,100][index%3]}% ${index<3?0:100}%`} as React.CSSProperties;
  return <div className={"thumb "+className}>
    {imageSrc&&!failed?<img src={imageSrc} alt="" loading="lazy" onError={()=>setFailed(true)}/>:<span className="thumb-sprite" style={spriteStyle}/>}
    <span className="duration">{video.duration_seconds?formatDuration(video.duration_seconds):"VIDEO"}</span>
    {video.sample_url&&<span className="demo-tag">DEMO</span>}
  </div>;
}
export function VideoCard({video,onOpen,onChannel,compact=false}:{video:Video;onOpen:(id:string)=>void;onChannel:(handle:string)=>void;compact?:boolean}){
  return <article className={compact?"video-card compact":"video-card"}>
    <button className="video-thumb-button" onClick={()=>onOpen(video.id)} aria-label={"Watch "+video.title}><Thumb video={video}/></button>
    <div className="video-card-info">
      {!compact&&<button className="avatar-button" onClick={()=>onChannel(video.channel_handle)} aria-label={"Open "+video.channel_name+" channel"}><Avatar name={video.channel_name} url={video.channel_avatar} size={36}/></button>}
      <div><button className="video-title" onClick={()=>onOpen(video.id)}>{video.title}</button><button className="video-channel" onClick={()=>onChannel(video.channel_handle)}>{video.channel_name}</button><p className="video-meta">{formatViews(video.views)} views <span>·</span> {formatDate(video.created_at)}</p></div>
    </div>
  </article>;
}
export function Player({video,onWatch,onNext}:{video:Video;onWatch:(progress:number)=>void;onNext?:()=>void}){
  const ref=useRef<HTMLVideoElement>(null),shell=useRef<HTMLDivElement>(null);
  const [playing,setPlaying]=useState(false),[current,setCurrent]=useState(0),[duration,setDuration]=useState(video.duration_seconds||0),[volume,setVolume]=useState(1),[speed,setSpeed]=useState(1),[fullscreen,setFullscreen]=useState(false),[started,setStarted]=useState(false);
  const lastSaved=useRef(0);
  const src=video.media_key?`/api/media/video/${video.id}`:video.sample_url||"";
  useEffect(()=>{setPlaying(false);setCurrent(0);setDuration(video.duration_seconds||0);setStarted(false);lastSaved.current=0;},[video.id,video.duration_seconds]);
  function toggle(){const el=ref.current;if(!el)return;if(el.paused){el.play().catch(()=>{});}else el.pause();}
  function save(force=false){const at=ref.current?.currentTime||0;if(force||Math.abs(at-lastSaved.current)>15){lastSaved.current=at;onWatch(at);}}
  function seek(value:number){if(ref.current){ref.current.currentTime=value;setCurrent(value);}}
  function full(){if(!shell.current)return;if(!document.fullscreenElement)shell.current.requestFullscreen?.();else document.exitFullscreen?.();}
  useEffect(()=>{const sync=()=>setFullscreen(!!document.fullscreenElement);document.addEventListener("fullscreenchange",sync);return()=>document.removeEventListener("fullscreenchange",sync);},[]);
  function keys(e:React.KeyboardEvent){if(e.key===" "||e.key.toLowerCase()==="k"){e.preventDefault();toggle();}if(e.key==="ArrowRight")seek(Math.min(duration,current+5));if(e.key==="ArrowLeft")seek(Math.max(0,current-5));if(e.key.toLowerCase()==="m"){const next=volume?0:1;setVolume(next);if(ref.current)ref.current.volume=next;}}
  return <div className="player-shell" ref={shell} tabIndex={0} onKeyDown={keys} aria-label="Video player">
    <video ref={ref} src={src} preload="metadata" playsInline onClick={toggle}
      onLoadedMetadata={e=>setDuration(e.currentTarget.duration||video.duration_seconds||0)}
      onPlay={()=>{setPlaying(true);setStarted(true);save(true);}}
      onPause={()=>{setPlaying(false);save(true);}}
      onTimeUpdate={e=>{setCurrent(e.currentTarget.currentTime);save();}}
      onEnded={()=>{setPlaying(false);save(true);}}/>
    {!started&&<div className="player-poster"><Thumb video={video}/><button onClick={toggle} aria-label="Play video"><Play size={32} fill="currentColor"/></button></div>}
    <div className="player-controls"><input className="seek" aria-label="Seek video" type="range" min="0" max={Math.max(duration,1)} step="0.1" value={Math.min(current,duration||0)} onChange={e=>seek(Number(e.target.value))} style={{["--progress" as string]:`${duration?current/duration*100:0}%`}}/>
      <div className="player-actions"><button onClick={toggle} aria-label={playing?"Pause":"Play"}>{playing?<Pause size={18} fill="currentColor"/>:<Play size={18} fill="currentColor"/>}</button><button onClick={()=>seek(Math.max(0,current-10))} aria-label="Back 10 seconds"><RotateCcw size={16}/></button><span className="player-time">{formatDuration(current)} / {formatDuration(duration)}</span><div className="player-spacer"/><button onClick={()=>{const next=volume?0:1;setVolume(next);if(ref.current)ref.current.volume=next;}} aria-label={volume?"Mute":"Unmute"}>{volume?<Volume2 size={19}/>:<VolumeX size={19}/>}</button><input className="volume" type="range" min="0" max="1" step=".05" value={volume} aria-label="Volume" onChange={e=>{const next=Number(e.target.value);setVolume(next);if(ref.current)ref.current.volume=next;}}/><select className="speed" value={speed} aria-label="Playback speed" onChange={e=>{const next=Number(e.target.value);setSpeed(next);if(ref.current)ref.current.playbackRate=next;}}><option value=".5">0.5×</option><option value="1">1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option><option value="2">2×</option></select>{onNext&&<button onClick={onNext} aria-label="Next video"><SkipForward size={18}/></button>}<button onClick={full} aria-label={fullscreen?"Exit fullscreen":"Fullscreen"}>{fullscreen?<Minimize size={18}/>:<Maximize size={18}/>}</button></div>
    </div>
  </div>;
}
