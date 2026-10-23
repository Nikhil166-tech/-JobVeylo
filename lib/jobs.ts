import {bindings} from './platform';
import seeds from './seeds.json';
export type Job=typeof seeds[number];
export const db=()=>bindings().DB;
type ListingRow={id:string;data:string;status:string;version:number};
export function effective(j:Job):Job{
  const today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});
  return j.status==='published'&&/^\d{4}-\d{2}-\d{2}$/.test(j.deadline)&&j.deadline<today?{...j,status:'closed'}:j;
}
const fromRow=(r:ListingRow):Job=>effective({...JSON.parse(r.data),id:r.id,status:r.status,version:r.version});
export async function allJobs():Promise<Job[]>{
  const rows=await db().prepare('SELECT id,data,status,version FROM listings').all<ListingRow>();
  return rows.results.map(fromRow).sort((a,b)=>b.checked.localeCompare(a.checked));
}
export async function getJob(id:string):Promise<Job|undefined>{
  const row=await db().prepare('SELECT id,data,status,version FROM listings WHERE id=?').bind(id).first<ListingRow>();
  return row?fromRow(row):undefined;
}
