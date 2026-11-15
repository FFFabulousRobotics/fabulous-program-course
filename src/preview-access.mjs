import {randomBytes} from 'node:crypto';

// A capability grants access to one PDF only; every request still checks the
// originating login session and the material's current publication state.
const tickets=new Map();
export function revokePreviewAccess(sessionHashes,userId){
  const hashes=new Set(sessionHashes);
  for(const [ticket,item] of tickets)if(hashes.has(item.sessionHash)||(userId&&item.userId===userId))tickets.delete(ticket);
}
export function issuePreviewAccess(sessionHash,materialId,userId){
  const now=Date.now();
  for(const [ticket,item] of tickets){
    if(item.expires<=now)tickets.delete(ticket);
    else if(item.sessionHash===sessionHash&&item.materialId===materialId)return ticket;
  }
  if(tickets.size>=1024)tickets.delete(tickets.keys().next().value);
  const ticket=randomBytes(32).toString('hex');
  tickets.set(ticket,{sessionHash,materialId,userId,expires:now+43200000});
  return ticket;
}
export function previewSessionHash(req){
  if(!['GET','HEAD'].includes(req.method))return null;
  const url=new URL(req.url,'http://localhost');
  const match=url.pathname.match(/^\/api\/materials\/([^/]+)\/preview$/);
  if(!match)return null;
  const item=tickets.get(url.searchParams.get('access'));
  return item&&item.materialId===match[1]&&item.expires>Date.now()?item.sessionHash:null;
}
