// Display helpers only. Deadlines and SLA status come from SQL (golden rule 4);
// the client needs "now" in sim time just to render countdowns.
export const simNow = (offsetSeconds: number) => new Date(Date.now() + offsetSeconds * 1000);

const LOCALE: Record<string, string> = { en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN' };
export const locale = (lang: string) => LOCALE[lang] ?? 'en-IN';

export const fmtWhen = (d: Date | string, lang: string) =>
  new Intl.DateTimeFormat(locale(lang), { weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(d));

/** Whole minutes split into the two largest units, e.g. {d:0,h:3,m:10}. */
export function splitDuration(ms: number) {
  const mins = Math.max(0, Math.round(Math.abs(ms) / 60_000));
  return { d: Math.floor(mins / 1440), h: Math.floor((mins % 1440) / 60), m: mins % 60 };
}
