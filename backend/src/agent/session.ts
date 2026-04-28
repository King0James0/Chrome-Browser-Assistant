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

export async function selectActivePage(
  s: ModeAConnection,
  ctx: PageContext | undefined,
): Promise<Page> {
  const pages = s.pages();
  if (pages.length === 0) {
    throw new Error('No tabs found in user Chrome — open at least one tab and try again.');
  }
  if (ctx?.url) {
    const exact = pages.find((p) => p.url() === ctx.url);
    if (exact) return exact;
    const stripped = stripFragment(ctx.url);
    const fuzzy = pages.find((p) => stripFragment(p.url()) === stripped);
    if (fuzzy) return fuzzy;
  }
  return pages[pages.length - 1]!;
}

function stripFragment(url: string): string {
  const i = url.indexOf('#');
  return i < 0 ? url : url.slice(0, i);
}
