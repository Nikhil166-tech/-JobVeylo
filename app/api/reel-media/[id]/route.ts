import {bindings} from '../../../../lib/platform';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const id=new URL(request.url).pathname.split('/').pop()?.replace(/\.mp4$/,'')||'';
 if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)||id.length>180)return new Response('Not found',{status:404});
 const env=bindings();if(!env.REEL_MEDIA)return new Response('Not found',{status:404});
 const media=await env.REEL_MEDIA.get('reels/'+id+'.mp4','arrayBuffer');if(!media)return new Response('Not found',{status:404});
 const headers={'Content-Type':'video/mp4','Cache-Control':'public, max-age=3600','Accept-Ranges':'bytes','Content-Length':String(media.byteLength)};
 const range=request.headers.get('range')?.match(/^bytes=(\d+)-(\d*)$/);
 if(range){const start=Number(range[1]),end=Math.min(range[2]?Number(range[2]):media.byteLength-1,media.byteLength-1);if(start>end||start>=media.byteLength)return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+media.byteLength}});return new Response(media.slice(start,end+1),{status:206,headers:{...headers,'Content-Length':String(end-start+1),'Content-Range':`bytes ${start}-${end}/${media.byteLength}`}})}
 return new Response(media,{headers});
}
