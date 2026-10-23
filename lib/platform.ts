import {env} from 'cloudflare:workers';

export type Bindings={
  DB:D1Database;
  SITE_URL:string;
  OWNER_GITHUB_ID:string;
  GITHUB_CLIENT_ID?:string;
  GITHUB_CLIENT_SECRET?:string;
  GROQ_API_KEY?:string;
  GROQ_RESUME_MODEL?:string;
};
export const bindings=()=>env as unknown as Bindings;
export const requestOrigin=()=>new URL(bindings().SITE_URL).origin;
export const sameOrigin=(request:Request)=>request.headers.get('origin')===requestOrigin();
