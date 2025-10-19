import createClient, { Middleware } from 'openapi-fetch';
import type { paths } from '../../types/generated/wp-json-openapi';

const baseUrl = `${process.env.WP_BASE}/wp-json`;
const auth = 'Basic ' + btoa(`${process.env.WP_USER}:${process.env.WP_PASSWORD}`);

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

const client = createClient<paths>({ baseUrl, fetch });

client.use(authMiddleware);
client.use(errorThrowingMiddleware);

export { client };
