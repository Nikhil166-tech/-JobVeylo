import type {Contact,ResumeDraft} from './resume';
import {extractResumeContact} from './resume-contact';

export async function readResume(file:File) {
  if(file.size>5*1024*1024)throw Error('Choose a file under 5 MB.');
  const extension=file.name.split('.').pop()?.toLowerCase();
  const buffer=await file.arrayBuffer();
  let text='';const embeddedLinks:string[]=[];
  if(extension==='txt')text=new TextDecoder().decode(buffer);
  else if(extension==='pdf'){
    const pdfjs=await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc='/pdf.worker.min.mjs';
    const task=pdfjs.getDocument({data:new Uint8Array(buffer)});
    const pdf=await task.promise;
    try{
      if(pdf.numPages>10)throw Error('Please use a resume with 10 pages or fewer.');
      for(let page=1;page<=pdf.numPages;page++){
        const content=await (await pdf.getPage(page)).getTextContent();
        for(const annotation of await (await pdf.getPage(page)).getAnnotations({intent:'display'})){if(typeof annotation.url==='string')embeddedLinks.push(annotation.url)}
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
    for(const name of Object.keys(files).filter(name=>name.endsWith('.rels'))){const rels=readXml(name);for(const rel of Array.from(rels.getElementsByTagNameNS('*','Relationship'))){if(rel.getAttribute('TargetMode')==='External'&&rel.getAttribute('Type')?.endsWith('/hyperlink'))embeddedLinks.push(rel.getAttribute('Target')||'')}}
    const parts=[...Object.keys(files).filter(name=>/^word\/header\d+\.xml$/.test(name)),'word/document.xml',...Object.keys(files).filter(name=>/^word\/footer\d+\.xml$/.test(name))];
    text=parts.map(name=>Array.from(readXml(name).getElementsByTagNameNS('*','p')).map(p=>Array.from(p.getElementsByTagNameNS('*','t')).map(t=>t.textContent).join('')).join('\n')).join('\n');
  }else throw Error('Use a PDF, DOCX or TXT file.');
  if(text.trim().length<30)throw Error('No readable text was found. Scanned PDFs need text recognition first, or use the form.');
  if(text.length>10000)throw Error('This resume exceeds 10,000 characters. Please shorten it or paste the relevant sections.');
  return {text:text.trim(),...extractResumeContact(text.trim(),embeddedLinks)};
}
export {resumeSections} from './resume-template';
function download(blob:Blob,name:string){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
export async function exportResume(format:'pdf'|'docx',contact:Contact,draft:ResumeDraft,paper:import('./resume-template').PaperSize='a4'){
 const {buildResumeFile}=await import('./resume-export');
 const file=await buildResumeFile(format,contact,draft,paper);
 const name=(contact.name.trim()||'JobVeylo-resume').replace(/[^a-z0-9-]/gi,'-').slice(0,70);
 download(file,name+'.'+format);
}
