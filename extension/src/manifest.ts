import { defineManifest } from '@crxjs/vite-plugin';
import pkg from '../package.json';

export default defineManifest({
  manifest_version: 3,
  name: 'Chrome-Browser-Assistant',
  description: 'An LLM-powered agent overlay for your browser.',
  version: pkg.version,
  permissions: ['storage', 'scripting', 'activeTab', 'tabs', 'contextMenus', 'downloads', 'alarms'],
  host_permissions: ['<all_urls>'],
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/content/index.tsx'],
      run_at: 'document_idle',
    },
  ],
  options_page: 'src/settings/index.html',
  action: {
    default_title: 'Chrome-Browser-Assistant',
  },
  commands: {
    'toggle-overlay': {
      suggested_key: { default: 'Alt+Shift+A' },
      description: 'Toggle the agent overlay',
    },
  },
  web_accessible_resources: [
    {
      resources: ['avatars/*'],
      matches: ['<all_urls>'],
    },
  ],
});
