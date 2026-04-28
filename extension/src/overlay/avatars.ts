export interface Avatar {
  id: string;
  name: string;
  src: string;
}

export const builtInAvatars: Avatar[] = [
  { id: 'astronaut', name: 'Astronaut', src: chrome.runtime.getURL('avatars/astronaut.svg') },
  { id: 'robot', name: 'Robot', src: chrome.runtime.getURL('avatars/robot.svg') },
  { id: 'owl', name: 'Owl', src: chrome.runtime.getURL('avatars/owl.svg') },
  { id: 'cat', name: 'Cat', src: chrome.runtime.getURL('avatars/cat.svg') },
  { id: 'ghost', name: 'Ghost', src: chrome.runtime.getURL('avatars/ghost.svg') },
  { id: 'blob', name: 'Blob', src: chrome.runtime.getURL('avatars/blob.svg') },
];

export function avatarSrc(id: string, customDataUrl?: string): string {
  if (id === 'custom' && customDataUrl) return customDataUrl;
  const found = builtInAvatars.find((a) => a.id === id);
  return found?.src ?? builtInAvatars[0]!.src;
}
