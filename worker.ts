import { onRequest as handleApiRequest } from './functions/api/[[path]].ts';

interface AssetsBinding {
  fetch(request: Request): Promise<Response>;
}

export interface CloudflareWorkerEnv {
  ASSETS?: AssetsBinding;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  API_FOOTBALL_KEY?: string;
}

export default {
  async fetch(request: Request, env: CloudflareWorkerEnv): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      return handleApiRequest({
        request,
        env,
        params: {},
      });
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('Static assets binding not configured.', { status: 404 });
  },
};
