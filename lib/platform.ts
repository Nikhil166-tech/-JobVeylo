import {env} from 'cloudflare:workers';

export type Bindings={
  DB:D1Database;
  COLLECTOR?:Fetcher;
  SITE_URL:string;
  OWNER_GITHUB_ID:string;
  GITHUB_CLIENT_ID?:string;
  GITHUB_CLIENT_SECRET?:string;
  GROQ_API_KEY?:string;
  GROQ_RESUME_MODEL?:string;
  WHATSAPP_APP_SECRET?:string;
  WHATSAPP_VERIFY_TOKEN?:string;
  WHATSAPP_PHONE_NUMBER_ID?:string;
  WHATSAPP_BUSINESS_NUMBER?:string;
  WHATSAPP_SIGNUPS_ENABLED?:string;
  REEL_MEDIA?:KVNamespace;
  JOBVEYLO_AUTOMATION_KEY?:string;
  INSTAGRAM_ACCESS_TOKEN?:string;
  INSTAGRAM_ACCOUNT_ID?:string;
};
export const bindings=()=>env as unknown as Bindings;
export const requestOrigin=()=>new URL(bindings().SITE_URL).origin;
export const sameOrigin=(request:Request)=>request.headers.get('origin')===requestOrigin();
