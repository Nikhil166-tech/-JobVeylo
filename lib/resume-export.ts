import type {Contact,ResumeDraft} from './resume.ts';
import {contactLines,resumeHeaderLinks,resumeSections,resumeLayout,paperSizes,type PaperSize} from './resume-template.ts';

type Fonts={regular:Uint8Array;bold:Uint8Array};
export async function buildResumeFile(format:'pdf'|'docx',contact:Contact,draft:ResumeDraft,paper:PaperSize='a4',fonts?:Fonts):Promise<Blob>{
 const sections=resumeSections(draft,contact),contacts=contactLines(contact),profiles=resumeHeaderLinks(contact,draft),size=paperSizes[paper],layout=resumeLayout;
 if(!fonts){
  const responses=await Promise.all([fetch('/fonts/LibertinusSerif-Regular.ttf'),fetch('/fonts/LibertinusSerif-Bold.ttf')]);
  if(responses.some(r=>!r.ok))throw Error('The resume fonts could not load. Please try the download again.');
  fonts={regular:new Uint8Array(await responses[0].arrayBuffer()),bold:new Uint8Array(await responses[1].arrayBuffer())};
 }
 if(format==='docx'){
  const {Document,Paragraph,TextRun,ExternalHyperlink,Packer,HeadingLevel,AlignmentType,BorderStyle,LevelFormat,TabStopType}=await import('docx');
  const twips=(mm:number)=>Math.round(mm/25.4*1440);
  const linkRuns=(links:{url:string;label:string}[])=>links.flatMap((link,i)=>[...(i?[new TextRun({text:' | ',size:18})]:[]),new ExternalHyperlink({link:link.url,children:[new TextRun({text:link.label,font:'Libertinus Serif',size:18,color:'164575'})]})]);
  const document=new Document({fonts:[{name:'Libertinus Serif',data:fonts.regular as Buffer,bold:fonts.bold as Buffer}],creator:contact.name||undefined,title:contact.name?`${contact.name} Resume`:'Resume',numbering:{config:[{reference:'resume-dashes',levels:[{level:0,format:LevelFormat.BULLET,text:'-',alignment:AlignmentType.LEFT,style:{paragraph:{indent:{left:240,hanging:180}}}}]}]},styles:{default:{document:{run:{font:'Libertinus Serif',size:18,color:'111111'},paragraph:{spacing:{line:230,after:45}}}}},sections:[{properties:{page:{size:{width:twips(size.width),height:twips(size.height)},margin:{top:twips(layout.topMargin),bottom:twips(layout.margin),left:twips(layout.margin),right:twips(layout.margin)}}},children:[
   new Paragraph({heading:HeadingLevel.TITLE,alignment:AlignmentType.CENTER,keepNext:true,spacing:{before:0,after:50},children:[new TextRun({text:(contact.name.trim()||'Resume').toUpperCase(),font:'Libertinus Serif',bold:true,size:36,color:'111111'})]}),
   ...(contact.headline?.trim()?[new Paragraph({alignment:AlignmentType.CENTER,keepNext:true,spacing:{after:45},children:[new TextRun({text:contact.headline.trim(),bold:true,size:22})]})]:[]),
   ...contacts.map(text=>new Paragraph({alignment:AlignmentType.CENTER,keepNext:true,spacing:{after:45},children:[new TextRun({text,size:18,color:'333333'})]})),
   ...(profiles.length?[new Paragraph({alignment:AlignmentType.CENTER,keepNext:true,spacing:{after:45},children:linkRuns(profiles)})]:[]),
   ...sections.flatMap(section=>[
    new Paragraph({heading:HeadingLevel.HEADING_1,keepNext:true,keepLines:true,border:{bottom:{style:BorderStyle.SINGLE,size:3,color:'777777',space:3}},spacing:{before:170,after:85},children:[new TextRun({text:section.title.toUpperCase(),font:'Libertinus Serif',bold:true,size:18,color:'111111'})]}),
    ...section.paragraphs.map((p,i)=>new Paragraph({...(p.bullet?{numbering:{reference:'resume-dashes',level:0},indent:{left:240,hanging:180}}:{}),keepNext:!p.bullet&&!!section.paragraphs[i+1]&&!section.paragraphs[i+1].entry,keepLines:true,widowControl:true,tabStops:p.right||p.links?[{type:TabStopType.RIGHT,position:twips(size.width-2*layout.margin)}]:[],spacing:{before:p.entry&&i?65:0,after:45},children:[new TextRun({text:p.text,bold:p.entry,font:'Libertinus Serif',size:18,color:'111111'}),...(p.links?[new TextRun({text:p.text.length+p.links.map(l=>l.label).join(' | ').length>105?'\n':'\t'}),...linkRuns(p.links)]:p.right?[new TextRun({text:'\t'+p.right,bold:false,font:'Libertinus Serif',size:18})]:[])]})),
   ]),
  ]}]});
  return Packer.toBlob(document);
 }
 const {jsPDF}=await import('jspdf');
 const pdf=new jsPDF({unit:'mm',format:paper,putOnlyUsedFonts:true,compress:true});
 for(const [style,bytes] of Object.entries(fonts)){
  let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  const file=`Resume-${style}.ttf`;pdf.addFileToVFS(file,btoa(binary));pdf.addFont(file,'Resume',style==='bold'?'bold':'normal');
 }
 const width=size.width-2*layout.margin,bottom=size.height-layout.margin;
 let y=layout.topMargin;
 const ensure=(height:number)=>{if(y+height>bottom){pdf.addPage();y=layout.margin}};
 function lines(text:string,fontSize:number,bold=false,indent=0){pdf.setFont('Resume',bold?'bold':'normal');pdf.setFontSize(fontSize);return pdf.splitTextToSize(text,width-indent) as string[]}
 function write(text:string,fontSize:number,bold=false,bullet=false,lineHeight=layout.lineHeight,keepNext=0,center=false){
  const indent=bullet?4.5:0,wrapped=lines(text,fontSize,bold,indent);
  // Keep short paragraphs and their first following line together. Long content flows naturally.
  ensure(wrapped.length<=12?wrapped.length*lineHeight+keepNext:2*lineHeight);
  for(let i=0;i<wrapped.length;i++){
   ensure(lineHeight);pdf.setFont('Resume',bold?'bold':'normal');pdf.setFontSize(fontSize);pdf.setTextColor(17,17,17);
   if(bullet&&i===0)pdf.text('-',layout.margin+.5,y+lineHeight*.76);
   pdf.text(wrapped[i],center?size.width/2:layout.margin+indent,y+lineHeight*.76,{align:center?'center':'left'});y+=lineHeight;
  }
 }
 function writeLinks(links:{url:string;label:string}[],align:'center'|'right'='right'){
  pdf.setFont('Resume','normal');pdf.setFontSize(8.8);
  const rows:{text:string;url:string}[][]=[[]];let used=0;
  for(const link of links)for(const part of pdf.splitTextToSize(link.label,width) as string[]){const row=rows[rows.length-1],extra=pdf.getTextWidth(part)+(row.length?pdf.getTextWidth(' | '):0);if(row.length&&used+extra>width){rows.push([]);used=0}const current=rows[rows.length-1];used+=pdf.getTextWidth(part)+(current.length?pdf.getTextWidth(' | '):0);current.push({text:part,url:link.url})}
  for(const row of rows){if(!row.length)continue;ensure(4.5);pdf.setFont('Resume','normal');pdf.setFontSize(8.8);const total=pdf.getTextWidth(row.map(p=>p.text).join(' | '));let x=align==='center'?(size.width-total)/2:size.width-layout.margin-total;for(let i=0;i<row.length;i++){if(i){pdf.setTextColor(51,51,51);pdf.text(' | ',x,y+3.42);x+=pdf.getTextWidth(' | ')}pdf.setTextColor(22,69,117);pdf.textWithLink(row[i].text,x,y+3.42,{url:row[i].url});x+=pdf.getTextWidth(row[i].text)}y+=4.5}
 }
 write((contact.name.trim()||'Resume').toUpperCase(),layout.nameSize,true,false,7.8,0,true);
 if(contact.headline?.trim())write(contact.headline.trim(),11,true,false,5,0,true);
 for(const contact of contacts){write(contact,8.8,false,false,4.5,0,true)}
 if(profiles.length)writeLinks(profiles,'center');
 y+=1;
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
  ensure(11+(firstLines<=12?firstLines:2)*layout.lineHeight+followingHeight(0)+(first.right?layout.lineHeight:0));
  y+=3;write(section.title.toUpperCase(),layout.sectionSize,true,false,5.7);pdf.setDrawColor(119,119,119);pdf.setLineWidth(.15);pdf.line(layout.margin,y,size.width-layout.margin,y);y+=2.3;
  for(let i=0;i<section.paragraphs.length;i++){
   const p=section.paragraphs[i];if(p.entry&&i)y+=1.5;
   if(p.links){
    pdf.setFont('Resume','normal');pdf.setFontSize(8.8);const linkWidth=pdf.getTextWidth(p.links.map(l=>l.label).join(' | '));pdf.setFont('Resume','bold');pdf.setFontSize(layout.bodySize);
    if(pdf.getTextWidth(p.text)+linkWidth+5<=width){ensure(layout.lineHeight+followingHeight(i));pdf.setFont('Resume','bold');pdf.setFontSize(layout.bodySize);pdf.setTextColor(17,17,17);pdf.text(p.text,layout.margin,y+layout.lineHeight*.76);writeLinks(p.links)}
    else{write(p.text,layout.bodySize,true,false,layout.lineHeight,4.5+followingHeight(i));writeLinks(p.links)}
   }else if(p.right){
    pdf.setFont('Resume','normal');pdf.setFontSize(10);const rightWidth=pdf.getTextWidth(p.right);
    pdf.setFont('Resume','bold');pdf.setFontSize(layout.bodySize);
    if(pdf.getTextWidth(p.text)+rightWidth+5<=width){
     ensure(layout.lineHeight+followingHeight(i));pdf.setFont('Resume','bold');pdf.setFontSize(layout.bodySize);pdf.text(p.text,layout.margin,y+layout.lineHeight*.76);
     pdf.setFont('Resume','normal');pdf.setFontSize(10);pdf.text(p.right,size.width-layout.margin,y+layout.lineHeight*.76,{align:'right'});y+=layout.lineHeight;
    }else{write(p.text,layout.bodySize,true,false,layout.lineHeight,layout.lineHeight+followingHeight(i));write(p.right,10,false,false,layout.lineHeight,followingHeight(i))}
   }else write(p.text,layout.bodySize,p.entry,p.bullet,layout.lineHeight,followingHeight(i));y+=.6;
  }
 }
 pdf.setProperties({title:contact.name?`${contact.name} Resume`:'Resume',author:contact.name||'',subject:'Resume'});
 return pdf.output('blob');
}
