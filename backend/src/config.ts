import 'dotenv/config';

export const config = {
  backendHost: process.env.BACKEND_HOST ?? '127.0.0.1',
  backendPort: Number(process.env.BACKEND_PORT ?? '50090'),
  routerPort: Number(process.env.ROUTER_PORT ?? '50091'),
  dataDir: process.env.DATA_DIR ?? './data',
  chromeDebugPort: Number(process.env.CHROME_DEBUG_PORT ?? '9222'),
  chromeUserDataDir: process.env.CHROME_USER_DATA_DIR,
  defaultModel: process.env.DEFAULT_MODEL ?? '',
  providers: {
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-5',
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
      baseUrl: process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
    },
    openrouter: {
      apiKey: process.env.OPENROUTER_API_KEY,
      model: process.env.OPENROUTER_MODEL ?? 'openrouter/auto',
      baseUrl: 'https://openrouter.ai/api/v1',
    },
    ollama: {
      baseUrl: process.env.OLLAMA_BASE_URL,
      model: process.env.OLLAMA_MODEL,
    },
    vllm: {
      baseUrl: process.env.VLLM_BASE_URL,
      model: process.env.VLLM_MODEL,
    },
    lmStudio: {
      baseUrl: process.env.LM_STUDIO_BASE_URL,
      model: process.env.LM_STUDIO_MODEL,
    },
  },
};
