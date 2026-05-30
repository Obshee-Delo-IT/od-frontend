import createClient, { Middleware } from 'openapi-fetch';
import type { paths } from '../../types/generated/wp-json-openapi';

const { WP_BASE, WP_USER, WP_PASSWORD } = process.env;
const hasWpConfig = Boolean(WP_BASE && WP_USER && WP_PASSWORD);

if (!hasWpConfig) {
  // eslint-disable-next-line no-console
  console.warn(
    '[httpClient] WP_BASE / WP_USER / WP_PASSWORD missing — using stub client; all WP requests return empty data. ' +
      'This is expected in CI builds without secrets; in dev/prod it means the .env is incomplete.'
  );
}

const stubFetch: typeof fetch = async () =>
  new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });

const baseUrl = `${WP_BASE ?? 'http://wp.invalid'}/wp-json`;
const auth = 'Basic ' + btoa(`${WP_USER ?? ''}:${WP_PASSWORD ?? ''}`);

const authMiddleware: Middleware = {
  onRequest: ({ request }) => {
    request.headers.set('Authorization', auth);
  },
};

const errorThrowingMiddleware: Middleware = {
  onResponse: ({ response }) => {
    if (!response.ok) {
      throw new Error(`${response.url}: ${response.status} ${response.statusText}`);
    }
  },
};

const client = createClient<paths>({ baseUrl, fetch: hasWpConfig ? fetch : stubFetch });

client.use(authMiddleware);
client.use(errorThrowingMiddleware);

export { client };
