import type {Contact,ResumeDraft} from './resume.ts';
import {contactLines,resumeSections,resumeLayout,paperSizes,type PaperSize} from './resume-template.ts';

type Fonts={regular:Uint8Array;bold:Uint8Array};
export async function buildResumeFile(format:'pdf'|'docx',contact:Contact,draft:ResumeDraft,paper:PaperSize='a4',fonts?:Fonts):Promise<Blob>{
 const sections=resumeSections(draft),contacts=contactLines(contact),size=paperSizes[paper],layout=resumeLayout;
 if(format==='docx'){
  const {Document,Paragraph,TextRun,Packer,HeadingLevel}=await import('docx');
  const twips=(mm:number)=>Math.round(mm/25.4*1440);
  const document=new Document({creator:contact.name||undefined,title:contact.name?`${contact.name} Resume`:'Resume',styles:{default:{document:{run:{font:'Arial',size:22,color:'111111'},paragraph:{spacing:{line:276,after:70}}}}},sections:[{properties:{page:{size:{width:twips(size.width),height:twips(size.height)},margin:{top:twips(layout.margin),bottom:twips(layout.margin),left:twips(layout.margin),right:twips(layout.margin)}}},children:[
   new Paragraph({heading:HeadingLevel.TITLE,keepNext:true,spacing:{before:0,after:100},children:[new TextRun({text:contact.name.trim()||'Resume',font:'Arial',bold:true,size:42,color:'111111'})]}),
   ...contacts.map(text=>new Paragraph({keepNext:true,spacing:{after:60},children:[new TextRun({text,size:19,color:'333333'})]})),
   ...sections.flatMap(section=>[
    new Paragraph({heading:HeadingLevel.HEADING_1,keepNext:true,keepLines:true,spacing:{before:220,after:100},children:[new TextRun({text:section.title.toUpperCase(),font:'Arial',bold:true,size:22,color:'111111'})]}),
    ...section.paragraphs.map((p,i)=>new Paragraph({...(p.bullet?{bullet:{level:0},indent:{left:240,hanging:180}}:{}),keepNext:!p.bullet&&!!section.paragraphs[i+1]&&!section.paragraphs[i+1].entry,keepLines:true,widowControl:true,spacing:{before:p.entry&&i?70:0,after:65},children:[new TextRun({text:p.text,bold:p.entry,font:'Arial',size:22,color:'111111'})]})),
   ]),
  ]}]});
  return Packer.toBlob(document);
 }
 const {jsPDF}=await import('jspdf');
 if(!fonts){
  const responses=await Promise.all([fetch('/fonts/DejaVuSans.ttf'),fetch('/fonts/DejaVuSans-Bold.ttf')]);
  if(responses.some(r=>!r.ok))throw Error('The PDF fonts could not load. Try the Word download.');
  fonts={regular:new Uint8Array(await responses[0].arrayBuffer()),bold:new Uint8Array(await responses[1].arrayBuffer())};
 }
 const pdf=new jsPDF({unit:'mm',format:paper,putOnlyUsedFonts:true,compress:true});
 for(const [style,bytes] of Object.entries(fonts)){
  let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  const file=`Resume-${style}.ttf`;pdf.addFileToVFS(file,btoa(binary));pdf.addFont(file,'Resume',style==='bold'?'bold':'normal');
 }
 const width=size.width-2*layout.margin,bottom=size.height-layout.margin;
 let y=layout.margin;
 const ensure=(height:number)=>{if(y+height>bottom){pdf.addPage();y=layout.margin}};
 function lines(text:string,fontSize:number,bold=false,indent=0){pdf.setFont('Resume',bold?'bold':'normal');pdf.setFontSize(fontSize);return pdf.splitTextToSize(text,width-indent) as string[]}
 function write(text:string,fontSize:number,bold=false,bullet=false,lineHeight=layout.lineHeight,keepNext=0){
  const indent=bullet?4.5:0,wrapped=lines(text,fontSize,bold,indent);
  // Keep short paragraphs and their first following line together. Long content flows naturally.
  ensure(wrapped.length<=12?wrapped.length*lineHeight+keepNext:2*lineHeight);
  for(let i=0;i<wrapped.length;i++){
   ensure(lineHeight);pdf.setFont('Resume',bold?'bold':'normal');pdf.setFontSize(fontSize);pdf.setTextColor(17,17,17);
   if(bullet&&i===0)pdf.text('•',layout.margin+.5,y+lineHeight*.76);
   pdf.text(wrapped[i],layout.margin+indent,y+lineHeight*.76);y+=lineHeight;
  }
 }
 write(contact.name.trim()||'Resume',layout.nameSize,true,false,9);y+=1;
 for(const contact of contacts){write(contact,9.5,false,false,4.8)}
 y+=2;
 for(const section of sections){
  const followingHeight=(index:number)=>{
   if(!section.paragraphs[index].entry)return 0;
   let height=0;
   for(let j=index+1;j<section.paragraphs.length&&!section.paragraphs[j].entry;j++){
    const next=section.paragraphs[j];height+=Math.min(2,lines(next.text,layout.bodySize,false,next.bullet?4.5:0).length)*layout.lineHeight+1;
    if(next.bullet||height>=layout.lineHeight*5)break;
   }
   return height;
  };
  const first=section.paragraphs[0],firstLines=lines(first.text,layout.bodySize,first.entry,first.bullet?4.5:0).length;
  ensure(11+(firstLines<=12?firstLines:2)*layout.lineHeight+followingHeight(0));
  y+=3;write(section.title.toUpperCase(),layout.sectionSize,true,false,5.7);y+=1.5;
  for(let i=0;i<section.paragraphs.length;i++){
   const p=section.paragraphs[i];if(p.entry&&i)y+=1.5;
   write(p.text,layout.bodySize,p.entry,p.bullet,layout.lineHeight,followingHeight(i));y+=1;
  }
 }
 pdf.setProperties({title:contact.name?`${contact.name} Resume`:'Resume',author:contact.name||'',subject:'Resume'});
 return pdf.output('blob');
}
