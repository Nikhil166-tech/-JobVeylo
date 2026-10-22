import { getDatabase } from '@netlify/database';
import seeds from './seeds.json';
export type Job = typeof seeds[number];
export const db = () => getDatabase();
export function effective(j: Job): Job {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  return j.status === 'published' && /^\d{4}-\d{2}-\d{2}$/.test(j.deadline) && j.deadline < today
    ? { ...j, status: 'closed' } : j;
}
export async function allJobs(): Promise<Job[]> {
  const rows = await db().sql<{data: Job; id: string; status: string; version: number}>`
    SELECT id, data, status, version FROM listings`;
  return rows.map(r => effective({...r.data, id:r.id, status:r.status, version:r.version}))
    .sort((a,b) => b.checked.localeCompare(a.checked));
}
export async function getJob(id: string): Promise<Job | undefined> {
  const rows = await db().sql<{data: Job; id: string; status: string; version: number}>`
    SELECT id, data, status, version FROM listings WHERE id=${id}`;
  const r = rows[0];
  return r ? effective({...r.data, id:r.id, status:r.status, version:r.version}) : undefined;
}
