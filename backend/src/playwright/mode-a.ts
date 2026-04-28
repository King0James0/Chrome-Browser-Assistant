import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';

export interface ModeAConnection {
  browser: Browser;
  context: BrowserContext;
  pages(): Page[];
  close(): Promise<void>;
}

export async function connectModeA(debugPort: number): Promise<ModeAConnection> {
  let browser: Browser;
  try {
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${debugPort}`);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Couldn't connect to Chrome at 127.0.0.1:${debugPort}. ` +
        `Is Chrome running with --remote-debugging-port=${debugPort}? ` +
        `See docs/chrome-launch.md for setup. (${detail})`,
    );
  }

  const context = browser.contexts()[0];
  if (!context) {
    await browser.close().catch(() => {});
    throw new Error(
      'Connected to Chrome but no browser context was found. Open at least one tab and try again.',
    );
  }

  return {
    browser,
    context,
    pages: () => context.pages(),
    async close() {
      await browser.close();
    },
  };
}
