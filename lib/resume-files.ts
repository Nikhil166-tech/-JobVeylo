import type {Contact,ResumeDraft} from './resume';

export async function readResume(file:File) {
  if(file.size>5*1024*1024)throw Error('Choose a file under 5 MB.');
  const extension=file.name.split('.').pop()?.toLowerCase();
  const buffer=await file.arrayBuffer();
  let text='';
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
        text+=content.items.map(item=>'str' in item?item.str+('hasEOL' in item&&item.hasEOL?'\n':' '):'').join('')+'\n';
      }
    }finally{await task.destroy();}
  }else if(extension==='docx'){
    // Reject excessively expanded ZIP archives before handing them to the parser.
    const view=new DataView(buffer);let expanded=0;
    for(let offset=0;offset+46<=view.byteLength;offset++)if(view.getUint32(offset,true)===0x02014b50){expanded+=view.getUint32(offset+24,true);if(expanded>20*1024*1024)throw Error('This Word file is too large when expanded. Use a plain-text version.');offset+=45+view.getUint16(offset+28,true)+view.getUint16(offset+30,true)+view.getUint16(offset+32,true);}
    const {unzipSync,strFromU8}=await import('fflate');
    const files=unzipSync(new Uint8Array(buffer),{filter:entry=>entry.name==='word/document.xml'&&entry.originalSize<=20*1024*1024});
    if(!files['word/document.xml'])throw Error('This is not a readable DOCX file.');
    const xml=new DOMParser().parseFromString(strFromU8(files['word/document.xml']),'application/xml');
    if(xml.querySelector('parsererror'))throw Error('This Word file could not be read.');
    text=Array.from(xml.getElementsByTagNameNS('*','p')).map(p=>Array.from(p.getElementsByTagNameNS('*','t')).map(t=>t.textContent).join('')).join('\n');
  }else throw Error('Use a PDF, DOCX or TXT file.');
  if(text.trim().length<30)throw Error('No readable text was found. Scanned PDFs need text recognition first, or use the form.');
  if(text.length>10000)throw Error('This resume exceeds 10,000 characters. Please shorten it or paste the relevant sections.');
  return text.trim();
}
export function resumeLines(contact:Contact,draft:ResumeDraft){
  return [{title:contact.name||'Resume',text:[contact.email,contact.phone,contact.location,contact.links].filter(Boolean).join(' | ')},
    ...(draft.summary.text?[{title:'Summary',text:draft.summary.text}]:[]),
    ...(draft.skills.length?[{title:'Skills',text:draft.skills.join(' · ')}]:[]),
    ...draft.sections.map(s=>({title:s.title,text:s.content}))];
}
function download(blob:Blob,name:string){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
export async function exportResume(format:'pdf'|'docx',contact:Contact,draft:ResumeDraft){
  const lines=resumeLines(contact,draft),name=(contact.name||'JobVeylo-resume').replace(/[^a-z0-9-]/gi,'-').slice(0,70);
  if(format==='docx'){
    const {Document,Paragraph,TextRun,Packer}=await import('docx');
    const document=new Document({styles:{default:{document:{run:{font:'Arial',size:22}}}},sections:[{children:lines.flatMap((block,index)=>[
      new Paragraph({spacing:{before:index?240:0,after:100},children:[new TextRun({text:block.title,bold:true,size:index?26:36})]}),
      ...block.text.split('\n').map(text=>new Paragraph({text,spacing:{after:80}}))
    ])}]});
    download(await Packer.toBlob(document),name+'.docx');
  }else{
    const {jsPDF}=await import('jspdf');const pdf=new jsPDF();
    const response=await fetch('/fonts/DejaVuSans.ttf');if(!response.ok)throw Error('The PDF font could not load. Try the Word download.');
    const bytes=new Uint8Array(await response.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
    pdf.addFileToVFS('Resume.ttf',btoa(binary));pdf.addFont('Resume.ttf','Resume','normal');pdf.setFont('Resume');
    let y=20;for(let index=0;index<lines.length;index++){
      const block=lines[index];if(y>260){pdf.addPage();y=20;}pdf.setFontSize(index?13:19);
      for(const line of pdf.splitTextToSize(block.title,170)){if(y>275){pdf.addPage();y=20;}pdf.text(line,20,y);y+=7;}
      pdf.setFontSize(10);for(const line of pdf.splitTextToSize(block.text,170)){if(y>277){pdf.addPage();y=20;}pdf.text(line,20,y);y+=5;}
      y+=7;
    }pdf.setProperties({title:contact.name?contact.name+' — Resume':'Resume'});download(pdf.output('blob'),name+'.pdf');
  }
}
