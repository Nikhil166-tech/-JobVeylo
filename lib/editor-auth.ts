import { getUser } from '@netlify/identity';
import { redirect } from 'next/navigation';
export async function editorIdentity() {
  const user = await getUser();
  // Authorization uses the verified identity, never client-editable metadata.
  if (!user || user.email?.toLowerCase() !== 'itharajunikhil61@gmail.com') return null;
  return user;
}
export async function requireEditor() {
  const user = await editorIdentity();
  if (!user) redirect('/admin/login');
  return user;
}
export async function authorizeWrite(req: Request) {
  if (req.headers.get('origin') !== new URL(req.url).origin) return false;
  return !!(await editorIdentity());
}
