import type {Contact,ResumeDraft,ResumeLinkPlacement} from './resume';
import {extractResumeContact} from './resume-contact';
import {projectLinkPlacement} from './resume-link-layout';

export async function readResume(file:File) {
  if(file.size>5*1024*1024)throw Error('Choose a file under 5 MB.');
  const extension=file.name.split('.').pop()?.toLowerCase();
  const buffer=await file.arrayBuffer();
  let text='';const embeddedLinks:string[]=[],placements:ResumeLinkPlacement[]=[];
  if(extension==='txt')text=new TextDecoder().decode(buffer);
  else if(extension==='pdf'){
    const pdfjs=await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc='/pdf.worker.min.mjs';
    const task=pdfjs.getDocument({data:new Uint8Array(buffer)});
    const pdf=await task.promise;
    try{
      if(pdf.numPages>10)throw Error('Please use a resume with 10 pages or fewer.');
      for(let page=1;page<=pdf.numPages;page++){
        const pdfPage=await pdf.getPage(page),content=await pdfPage.getTextContent();
        const items=content.items.filter(item=>'str' in item);
        const rows:{y:number;items:typeof items;inProjects?:boolean}[]=[];
        for(const item of items){let row=rows.find(row=>Math.abs(row.y-item.transform[5])<2);if(!row){row={y:item.transform[5],items:[]};rows.push(row)}row.items.push(item)}
        rows.sort((a,b)=>b.y-a.y);let inProjects=false;
        for(const row of rows){row.items.sort((a,b)=>a.transform[4]-b.transform[4]);const line=row.items.map(item=>item.str).join(' ').trim();if(/^(?:personal |academic )?projects\s*:?$/i.test(line))inProjects=true;else if(/^(?:education|technical skills|skills|work experience|experience|certifications|achievements)\s*:?$/i.test(line))inProjects=false;row.inProjects=inProjects}
        for(const annotation of await pdfPage.getAnnotations({intent:'display'})){
          if(typeof annotation.url!=='string')continue;embeddedLinks.push(annotation.url);
          if(!Array.isArray(annotation.rect))continue;
          const [x0,y0,x1,y1]=annotation.rect,cy=(y0+y1)/2;
          const row=rows.reduce<typeof rows[number]|undefined>((best,row)=>!best||Math.abs(row.y-cy)<Math.abs(best.y-cy)?row:best,undefined);
          if(!row||Math.abs(row.y-cy)>12)continue;
          const overlapping=row.items.filter(item=>item.transform[4]+item.width>x0+1&&item.transform[4]<x1-1);
          let label=overlapping.map(item=>item.str).join(' ').trim();
          // PDF text runs can contain both labels even though each annotation has its own rectangle.
          const candidates=overlapping.flatMap(item=>Array.from(item.str.matchAll(/Live Demo|Git Repo|Source Code|Repository|GitHub|Demo/gi),match=>({label:match[0],x:item.transform[4]+(match.index+match[0].length/2)/Math.max(1,item.str.length)*item.width})));
          if(candidates.length)label=candidates.reduce((best,item)=>Math.abs(item.x-(x0+x1)/2)<Math.abs(best.x-(x0+x1)/2)?item:best).label;
          const placement=projectLinkPlacement(row.items.map(item=>item.str).join(' '),annotation.url,label,!!row.inProjects);
          if(placement)placements.push(placement);
        }
        text+=content.items.map(item=>'str' in item?item.str+('hasEOL' in item&&item.hasEOL?'\n':' '):'').join('')+'\n';
      }
    }finally{await task.destroy();}
  }else if(extension==='docx'){
    // Reject excessively expanded ZIP archives before handing them to the parser.
    const view=new DataView(buffer);let expanded=0;
    for(let offset=0;offset+46<=view.byteLength;offset++)if(view.getUint32(offset,true)===0x02014b50){expanded+=view.getUint32(offset+24,true);if(expanded>20*1024*1024)throw Error('This Word file is too large when expanded. Use a plain-text version.');offset+=45+view.getUint16(offset+28,true)+view.getUint16(offset+30,true)+view.getUint16(offset+32,true);}
    const {unzipSync,strFromU8}=await import('fflate');
    const files=unzipSync(new Uint8Array(buffer),{filter:entry=>/^word\/(?:document|header\d+|footer\d+)\.xml$|^word\/_rels\/(?:document|header\d+|footer\d+)\.xml\.rels$/.test(entry.name)&&entry.originalSize<=20*1024*1024});
    if(!files['word/document.xml'])throw Error('This is not a readable DOCX file.');
    const readXml=(name:string)=>{const xml=new DOMParser().parseFromString(strFromU8(files[name]),'application/xml');if(xml.querySelector('parsererror'))throw Error('This Word file could not be read.');return xml};
    const relations=new Map<string,Map<string,string>>();
    for(const name of Object.keys(files).filter(name=>name.endsWith('.rels'))){const rels=readXml(name),targets=new Map<string,string>();for(const rel of Array.from(rels.getElementsByTagNameNS('*','Relationship'))){if(rel.getAttribute('TargetMode')==='External'&&rel.getAttribute('Type')?.endsWith('/hyperlink')){const url=rel.getAttribute('Target')||'';embeddedLinks.push(url);targets.set(rel.getAttribute('Id')||'',url)}}relations.set(name.replace('word/_rels/','word/').replace(/\.rels$/,''),targets)}
    const parts=[...Object.keys(files).filter(name=>/^word\/header\d+\.xml$/.test(name)),'word/document.xml',...Object.keys(files).filter(name=>/^word\/footer\d+\.xml$/.test(name))];
    text=parts.map(name=>{let inProjects=false;return Array.from(readXml(name).getElementsByTagNameNS('*','p')).map(p=>{const row=Array.from(p.getElementsByTagNameNS('*','t')).map(t=>t.textContent).join('');if(/^(?:personal |academic )?projects\s*:?$/i.test(row.trim()))inProjects=true;else if(/^(?:education|technical skills|skills|experience|work experience|certifications|achievements)\s*:?$/i.test(row.trim()))inProjects=false;for(const link of Array.from(p.getElementsByTagNameNS('*','hyperlink'))){const id=link.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id')||'',url=relations.get(name)?.get(id)||'',label=link.textContent||'';const placement=projectLinkPlacement(row,url,label,inProjects);if(placement)placements.push(placement)}return row}).join('\n')}).join('\n');
  }else throw Error('Use a PDF, DOCX or TXT file.');
  if(text.trim().length<30)throw Error('No readable text was found. Scanned PDFs need text recognition first, or use the form.');
  if(text.length>10000)throw Error('This resume exceeds 10,000 characters. Please shorten it or paste the relevant sections.');
  return {text:text.trim(),...extractResumeContact(text.trim(),embeddedLinks,placements)};
}
export {resumeSections} from './resume-template';
function download(blob:Blob,name:string){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
export async function exportResume(format:'pdf'|'docx',contact:Contact,draft:ResumeDraft,paper:import('./resume-template').PaperSize='a4'){
 const {buildResumeFile}=await import('./resume-export');
 const file=await buildResumeFile(format,contact,draft,paper);
 const name=(contact.name.trim()||'JobVeylo-resume').replace(/[^a-z0-9-]/gi,'-').slice(0,70);
 download(file,name+'.'+format);
}
