export const customFetch = (url: string, options?: RequestInit) => {
  const baseUrl = process.env.WP_BASE;
  const auth = 'Basic ' + btoa(`${process.env.WP_USER}:${process.env.WP_PASSWORD}`);

  return fetch(`${baseUrl}${url}`, {
    ...options,
    headers: {
      ...options?.headers,
      Authorization: auth,
    },
  });
};
