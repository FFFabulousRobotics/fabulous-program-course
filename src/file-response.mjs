import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {pipeline} from 'node:stream/promises';
import {createHash} from 'node:crypto';

export async function sendFile(req,res,file,filename,inline){
  const info=await stat(file.path),size=info.size;
  const etag='"'+createHash('sha256').update([file.path,size,info.mtimeMs,info.ctimeMs].join(':')).digest('hex')+'"';
  const headers={
    'Content-Type':file.type,'Accept-Ranges':'bytes','ETag':etag,
    'Last-Modified':info.mtime.toUTCString(),
    // Private caches may retain bytes, but must revalidate authorization.
    'Cache-Control':'private, no-cache','Referrer-Policy':'no-referrer',
    'X-Content-Type-Options':'nosniff','Content-Security-Policy':"frame-ancestors 'self'",
    'Content-Disposition':`${inline?'inline':'attachment'}; filename="material.${filename.split('.').at(-1)}"; filename*=UTF-8''${encodeURIComponent(filename)}`
  };
  const matches=req.headers['if-none-match']?.split(',').map(v=>v.trim().replace(/^W\//,''));
  if(matches?.some(v=>v==='*'||v===etag)){res.writeHead(304,headers);res.end();return;}
  let start=0,end=size-1,status=200;
  const range=req.method==='GET'&&(!req.headers['if-range']||req.headers['if-range']===etag)?req.headers.range:null;
  const match=range?.match(/^bytes=(\d*)-(\d*)$/);
  if(match&&(match[1]||match[2])){
    if(match[1]){start=Number(match[1]);if(match[2])end=Math.min(Number(match[2]),size-1);}
    else{const suffix=Number(match[2]);start=Math.max(0,size-suffix);}
    if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=size||end<start){res.writeHead(416,{...headers,'Content-Range':`bytes */${size}`,'Content-Length':0});res.end();return;}
    status=206;headers['Content-Range']=`bytes ${start}-${end}/${size}`;
  }
  headers['Content-Length']=Math.max(0,end-start+1);
  res.writeHead(status,headers);
  if(req.method==='HEAD'||!size){res.end();return;}
  try{await pipeline(createReadStream(file.path,{start,end}),res);}
  catch(e){if(!res.destroyed)throw e;}
}
