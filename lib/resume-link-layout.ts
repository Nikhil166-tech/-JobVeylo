import type {ResumeLinkPlacement} from './resume.ts';

// Use a link's original paragraph/row, never the order of unrelated URLs.
export function projectLinkPlacement(row:string,url:string,label:string,inProjects:boolean):ResumeLinkPlacement|undefined{
 if(!inProjects||!/^https?:\/\//i.test(url))return;
 const marker=/\b(?:live demo|git repo|github|source code|repository|demo)\b/i;
 const match=marker.exec(row);if(!match||match.index<3)return;
 const entry=row.slice(0,match.index).replace(/[\s|·–-]+$/,'').trim();
 const cleanLabel=label.trim().replace(/\s+/g,' ');
 if(!entry||!cleanLabel||cleanLabel.length>60)return;
 return {url,label:cleanLabel,entry,section:'Projects'};
}
