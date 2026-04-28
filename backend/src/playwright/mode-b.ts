import { chromium, type Browser, type Page } from 'playwright';

export interface ModeBSession {
  browser: Browser;
  page: Page;
  close(): Promise<void>;
}

export async function spawnModeB(): Promise<ModeBSession> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  return {
    browser,
    page,
    async close() {
      await browser.close();
    },
  };
}
