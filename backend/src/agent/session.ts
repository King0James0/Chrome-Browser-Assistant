import type { Page } from 'playwright';
import { connectModeA, type ModeAConnection } from '../playwright/mode-a';
import type { PageContext } from '../shared/types';

let session: ModeAConnection | null = null;

export async function getChromeSession(debugPort: number): Promise<ModeAConnection> {
  if (session?.browser.isConnected()) return session;
  session = await connectModeA(debugPort);
  session.browser.on('disconnected', () => {
    console.log('[chrome] disconnected from user Chrome');
    session = null;
  });
  return session;
}

const ACCEPTABLE_PREFIXES = ['http://', 'https://', 'file://'];

function isAcceptableUrl(url: string): boolean {
  if (!url) return false;
  return ACCEPTABLE_PREFIXES.some((p) => url.startsWith(p));
}

export async function selectActivePage(
  s: ModeAConnection,
  ctx: PageContext | undefined,
): Promise<Page> {
  const pages = s.pages();
  if (pages.length === 0) {
    throw new Error('No tabs found in user Chrome — open at least one tab and try again.');
  }

  if (ctx?.url && isAcceptableUrl(ctx.url)) {
    const exact = pages.find((p) => p.url() === ctx.url);
    if (exact) return exact;
    const stripped = stripFragment(ctx.url);
    const fuzzy = pages.find((p) => stripFragment(p.url()) === stripped);
    if (fuzzy) return fuzzy;
  }

  const allowed = pages.filter((p) => isAcceptableUrl(p.url()));
  if (allowed.length === 0) {
    const summary = pages
      .map((p) => p.url() || '<blank>')
      .slice(0, 5)
      .join(', ');
    const ctxNote = ctx?.url ? ` Your bubble reported being on: ${ctx.url}` : '';
    throw new Error(
      `No http(s) content tabs available. Tabs in this Chrome: ${summary}.${ctxNote} ` +
        `Switch to a real web page and try again.`,
    );
  }
  return allowed[allowed.length - 1]!;
}

function stripFragment(url: string): string {
  const i = url.indexOf('#');
  return i < 0 ? url : url.slice(0, i);
}
