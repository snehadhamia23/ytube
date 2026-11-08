import { clock, database, mediaBucket, response, user } from "../../../../../lib/server";

export const runtime="edge";
type Params={params:Promise<{kind:string;id:string}>};
const allowedVideo=new Set(["video/mp4","video/webm","video/ogg"]);
const allowedImage=new Set(["image/jpeg","image/png","image/webp"]);
async function record(id:string) {
  return await database().prepare("SELECT v.*,ch.owner_id FROM videos v JOIN channels ch ON ch.id=v.channel_id WHERE v.id=?").bind(id).first<Record<string,unknown>>();
}
export async function PUT(request:Request,{params}:Params) {
  try {
    const {kind,id}=await params,identity=await user();
    if(!identity)return response({error:"Sign in to upload."},401);
    if(kind!=="video"&&kind!=="thumbnail")return response({error:"Invalid media type."},400);
    const item=await record(id);
    if(!item||item.owner_id!==identity.userId||item.status==="deleted")return response({error:"Video not found in your channel."},403);
    const mime=(request.headers.get("content-type")||"").split(";")[0].toLowerCase();
    const size=Number(request.headers.get("content-length"));
    const max=kind==="video"?100*1024*1024:5*1024*1024;
    if(!Number.isFinite(size)||size<=0||size>max||!request.body)return response({error:kind==="video"?"Choose a video under 100 MB.":"Choose a thumbnail under 5 MB."},413);
    if(!(kind==="video"?allowedVideo:allowedImage).has(mime))return response({error:kind==="video"?"Use MP4, WebM, or Ogg video.":"Use JPEG, PNG, or WebP image."},415);
    const key=`${kind}/${id}/${crypto.randomUUID()}`;
    await mediaBucket().put(key,request.body,{httpMetadata:{contentType:mime},customMetadata:{uploadedBy:identity.userId}});
    const field=kind==="video"?"media_key":"thumbnail_key";
    await database().prepare(`UPDATE videos SET ${field}=?,duration_seconds=CASE WHEN ?='video' THEN ? ELSE duration_seconds END,updated_at=? WHERE id=?`)
      .bind(key,kind,Math.max(0,Math.min(43200,Math.floor(Number(request.headers.get("x-duration-seconds"))||0))),clock(),id).run();
    return response({ok:true,key});
  }catch(e){return response({error:e instanceof Error?e.message:"Upload failed."},500);}
}
export async function GET(request:Request,{params}:Params) {
  try {
    const {kind,id}=await params;
    if(kind!=="video"&&kind!=="thumbnail")return response({error:"Not found."},404);
    const item=await record(id),identity=await user();
    if(!item||(item.status!=="published"&&item.owner_id!==identity?.userId))return response({error:"Not found."},404);
    const key=kind==="video"?item.media_key:item.thumbnail_key;
    if(typeof key!=="string")return response({error:"Media unavailable."},404);
    const bucket=mediaBucket(),head=await bucket.head(key);
    if(!head)return response({error:"Media unavailable."},404);
    const range=request.headers.get("range"),size=head.size;
    let offset=0,length=size,status=200;
    if(range) {
      const match=/^bytes=(\d*)-(\d*)$/.exec(range);
      if(!match)return new Response(null,{status:416,headers:{"Content-Range":`bytes */${size}`}});
      const start=match[1]?Number(match[1]):null,end=match[2]?Number(match[2]):null;
      if(start===null&&end!==null){length=Math.min(end,size);offset=size-length;}
      else {offset=start??0;length=(end===null?size-1:Math.min(end,size-1))-offset+1;}
      if(offset<0||offset>=size||length<=0)return new Response(null,{status:416,headers:{"Content-Range":`bytes */${size}`}});
      status=206;
    }
    const object=await bucket.get(key,status===206?{range:{offset,length}}:undefined);
    if(!object)return response({error:"Media unavailable."},404);
    const headers=new Headers({"Accept-Ranges":"bytes","Content-Length":String(length),"Cache-Control":"public, max-age=3600","X-Content-Type-Options":"nosniff"});
    headers.set("Content-Type",object.httpMetadata?.contentType||(kind==="video"?"video/mp4":"image/jpeg"));
    if(status===206)headers.set("Content-Range",`bytes ${offset}-${offset+length-1}/${size}`);
    return new Response(object.body,{status,headers});
  }catch(e){return response({error:e instanceof Error?e.message:"Media unavailable."},500);}
}
