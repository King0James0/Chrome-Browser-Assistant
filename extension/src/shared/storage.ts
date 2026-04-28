export interface Settings {
  defaultModel: string;
  avatarId: string;
  avatarDataUrl?: string;
  bubblePosition: { x: number; y: number };
  chatSize: { width: number; height: number };
}

const DEFAULT_SETTINGS: Settings = {
  defaultModel: '',
  avatarId: 'astronaut',
  bubblePosition: { x: -1, y: -1 },
  chatSize: { width: 360, height: 440 },
};

export async function getSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...(stored.settings ?? {}) };
}

export async function setSettings(patch: Partial<Settings>): Promise<void> {
  const current = await getSettings();
  await chrome.storage.local.set({ settings: { ...current, ...patch } });
}
