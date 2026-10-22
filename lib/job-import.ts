import { load } from 'cheerio';

type RecordValue = Record<string, any>;
const list = (v: any): any[] => v == null ? [] : Array.isArray(v) ? v : [v];
export function plain(value: any): string {
  if (value == null) return '';
  if (Array.isArray(value)) return value.map(plain).filter(Boolean).join('; ');
  if (typeof value === 'object') return plain(value.name || value.description || value.value);
  const $ = load(String(value));
  $('script,style,noscript').remove();
  $('br').replaceWith('\n');
  $('p,div,li,h1,h2,h3,h4,tr').append('\n');
  return $.root().text().replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
function findJobs(value: any, found: RecordValue[], depth = 0) {
  if (!value || typeof value !== 'object' || depth > 20) return;
  if (Array.isArray(value)) { value.forEach(v => findJobs(v, found, depth + 1)); return; }
  if (list(value['@type']).some(t => /(^|[/#])JobPosting$/i.test(String(t)))) found.push(value);
  for (const [key, child] of Object.entries(value)) if (key !== '@context') findJobs(child, found, depth + 1);
}
function label(text: string, names: string) {
  return text.match(new RegExp(`(?:^|\\n)\\s*(?:${names})\\s*[:：]\\s*([^\\n]+)`, 'i'))?.[1]?.trim() || '';
}
function money(value: any, currency = ''): string {
  if (typeof value === 'string' || typeof value === 'number') return `${currency} ${value}`.trim();
  if (!value || typeof value !== 'object') return '';
  if (value.value && typeof value.value === 'object') return money(value.value, value.currency || currency);
  const amount = value.value ?? (value.minValue != null && value.maxValue != null ? `${value.minValue}–${value.maxValue}` : value.minValue != null ? `From ${value.minValue}` : value.maxValue != null ? `Up to ${value.maxValue}` : '');
  return amount === '' ? '' : `${value.currency || currency} ${amount}${value.unitText ? ` / ${value.unitText}` : ''}`.trim();
}
function locationText(value: any) {
  return list(value).map(place => {
    if (typeof place === 'string') return place;
    const a = place.address || place;
    return [a.addressLocality, a.addressRegion, plain(a.addressCountry)].filter(Boolean).join(', ') || plain(place.name);
  }).filter(Boolean).join('; ');
}
function section(text: string, heading: RegExp) {
  const lines = text.split('\n').map(s => s.trim()).filter(Boolean);
  const start = lines.findIndex(s => s.length < 100 && heading.test(s));
  if (start < 0) return '';
  const out: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^(description|(?:key job )?responsibilities|(?:basic |minimum |preferred )?qualifications|requirements|benefits|about (you|us|the role)|how to apply|salary|selection process|job details|share this job|join us on)\s*:?$/i.test(line)) break;
    out.push(line);
    if (out.join('\n').length > 2500) break;
  }
  return out.join('\n');
}

export function extractJob(html: string, sourceUrl: string, pastedText = false) {
  const $ = load(html);
  const candidates: RecordValue[] = [];
  if (!pastedText) $('script[type="application/ld+json"]').each((_, el) => {
    try { findJobs(JSON.parse($(el).text()), candidates); } catch { /* Other page scripts aren't job records. */ }
  });
  const unique = [...new Map(candidates.map(j => [JSON.stringify([j.title, j.hiringOrganization, j.identifier]), j])).values()];
  if (unique.length > 1) throw new Error('This page contains multiple openings. Paste the link for one specific job.');
  const j = unique[0] || {};
  const structured = unique.length === 1;
  const metaTitle = $('meta[property="og:title"]').attr('content') || '';
  const metaDescription = $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || '';
  $('script,style,noscript,nav,header,footer,form').remove();
  const body = pastedText ? plain(html) : plain($('main').first().html() || $('article').first().html() || $('body').html() || '');
  const description = plain(j.description) || body;
  const host = new URL(sourceUrl).hostname;
  const amazon = /(^|\.)amazon\.jobs$/i.test(host);
  if (description.length < 80) throw new Error('This page does not expose enough job details. Paste the job description below instead.');
  if (!structured && /captcha|verify (you are|that you are) human|access denied|enable javascript|just a moment/i.test(description.slice(0,600))) throw new Error('This website blocks automatic reading. Copy the job description and paste it below.');
  const title = plain(j.title) || label(body, 'job title|role|position|post name') || (!pastedText ? plain($('h1').first().text()) || plain(metaTitle) : '');
  const company = plain(j.hiringOrganization?.name) || label(body, 'company|employer|organization|organisation') || (amazon ? 'Amazon' : '');
  const remote = /TELECOMMUTE/i.test(plain(j.jobLocationType));
  const restrictions = locationText(j.applicantLocationRequirements);
  const physical = locationText(j.jobLocation);
  const location = (remote ? `Remote${restrictions || physical ? ` — ${restrictions || physical}` : ' — eligibility not specified'}` : physical) || label(body, 'job location|location|work location') || (amazon ? section(body,/^job details$/i).split('\n')[0]?.replace(/^IND,\s*[^,]+,\s*(.+)$/,'$1, India') : '') || '';
  const experience = plain(j.experienceRequirements) || (j.experienceRequirements?.monthsOfExperience != null ? `${j.experienceRequirements.monthsOfExperience} months of experience` : '') || label(description, 'experience|experience required') || description.match(/\b\d+(?:\s*[-–]\s*\d+|\+)?\s*(?:years?|months?)[^\n.!?]{0,90}\bexperience\b/i)?.[0] || '';
  const education = plain(j.educationRequirements) || label(description, 'education|qualification|qualifications|eligibility') || description.split('\n').find(l => /\b(bachelor|master|degree|diploma|graduate|B\.?Tech|B\.?E\.)\b/i.test(l) && l.length < 500) || '';
  const qualificationText = plain(j.qualifications) || section(description, /^(basic qualifications|minimum qualifications|qualifications|requirements|what you.bring)\s*:?$/i);
  const requirements = qualificationText.split('\n').map(s => s.replace(/^[-•*]\s*/, '').trim()).filter(Boolean).slice(0,30).map(s => s.slice(0,1000));
  if (!requirements.length) [experience,education].filter(Boolean).forEach(v => requirements.push(v.slice(0,1000)));
  const deadlineValue = plain(j.validThrough) || label(description, 'closing date|application deadline|last date|deadline');
  const deadline = /^\d{4}-\d{2}-\d{2}(?:T|$)/.test(deadlineValue) && !isNaN(Date.parse(deadlineValue)) ? deadlineValue.slice(0,10) : 'Not specified';
  const government = /\.(gov|nic)\.in$/i.test(host);
  const region = /\b(india|IN)\b/i.test(location) ? 'India' : /\b(USA|US|United States|Canada|Americas|Brazil|Mexico)\b/i.test(location) ? 'Americas' : /\b(UK|United Kingdom|Germany|France|Europe|Ireland|Netherlands)\b/i.test(location) ? 'Europe' : /\b(Singapore|Australia|Japan|Asia|New Zealand)\b/i.test(location) ? 'Asia Pacific' : /\b(worldwide|anywhere|global)\b/i.test(location) ? 'Worldwide' : 'Other';
  const level = /intern/i.test(`${title} ${plain(j.employmentType)}`) ? 'Internship' : /fresher|entry.level|no experience/i.test(`${title} ${experience}`) ? 'Fresher' : 'Experienced';
  const warnings = ['Confirm the original source and all imported details before publishing. Importing does not verify the employer or guarantee the opening is still available.'];
  if (!structured) warnings.push('No structured job record was found. Details were extracted from page text; check the fields carefully.');
  if (!title || !company || !location) warnings.push(`Please fill in: ${[!title && 'job title',!company && 'employer',!location && 'location'].filter(Boolean).join(', ')}.`);
  if (!experience) warnings.push('Experience was not found.');
  if (!education) warnings.push('Education requirements were not found.');
  if (!requirements.length) warnings.push('Add the eligibility requirements from the original notice.');
  if (deadlineValue && deadline === 'Not specified') warnings.push(`Confirm the closing date: ${deadlineValue.slice(0,150)}.`);
  const today = new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});
  if (deadline !== 'Not specified' && deadline < today) warnings.push('The listed deadline has passed. Save as closed or confirm an updated deadline.');
  warnings.push('Check the category, region, career level and source type; these are suggested classifications.');
  if (description.length > 10000) warnings.push('The description was shortened to fit. Review the complete source for omitted requirements.');
  const job = {
    version:0, title:title.slice(0,150), company:company.slice(0,100), location:location.slice(0,150), region,
    category:government?'Government':'Private', level, experience:(experience || 'Not specified').slice(0,100),
    education:(education || 'Not specified').slice(0,500), batch:label(description,'eligible batch|batch').slice(0,100) || 'Not specified',
    salary:(money(j.baseSalary) || label(description,'salary|compensation') || 'Not disclosed').slice(0,150),
    fees:(label(description,'application fee|application fees') || 'Not specified').slice(0,200), deadline, checked:today,
    remote:remote || /^remote\b/i.test(location), url:sourceUrl, sourceType:government?'Government authority':amazon?'Employer':'Third-party job board',
    summary:(plain(metaDescription) || section(description,/^description\s*:?$/i) || description).slice(0,1500), details:(section(description,/^(?:key job )?responsibilities\s*:?$/i) || section(description,/^description\s*:?$/i) || description).slice(0,10000), requirements,
    selection:(section(description,/^selection (process|procedure)\s*:?$/i) || 'Not specified by the employer').slice(0,3000),
    howToApply:'Open the linked original notice, confirm eligibility and availability, and follow the employer’s application instructions.',
    note:`Imported from ${host}. Review the original notice before publishing.`, tags:[],status:'draft',reviewed:false,
  };
  return {job,warnings,method:structured?'Structured job details':pastedText?'Pasted job description':'Page text'};
}
