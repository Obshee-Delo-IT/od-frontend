interface CustomFetchProps {
  addUrl: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
}

export const customFetch = ({ addUrl, method = 'GET' }: CustomFetchProps) => {
  const baseUrl = process.env.WP_BASE;
  const auth = 'Basic ' + btoa(`${process.env.WP_USER}:${process.env.WP_PASSWORD}`);

  return fetch(`${baseUrl}${addUrl}`, {
    method: method,
    headers: {
      Authorization: auth,
    },
  });
};
