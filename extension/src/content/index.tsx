import { createRoot } from 'react-dom/client';
import App from '../overlay/App';

const HOST_ID = 'chrome-browser-assistant-overlay-host';

function mount(): void {
  if (document.getElementById(HOST_ID)) return;

  const host = document.createElement('div');
  host.id = HOST_ID;
  host.style.cssText = 'all: initial; position: fixed; z-index: 2147483647;';
  document.documentElement.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });
  const mountPoint = document.createElement('div');
  shadow.appendChild(mountPoint);

  createRoot(mountPoint).render(<App />);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount, { once: true });
} else {
  mount();
}
