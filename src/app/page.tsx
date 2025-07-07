const Home = async () => {
  const a = await fetch('https://od-dev.tmweb.ru/wp-json/wp/v2/posts', {
    headers: {
      Authorization: 'Basic ' + btoa(`${process.env.WP_USER}:${process.env.WP_PASSWORD}`),
    },
  });
  const b = (await a.json()) as { id: number; title: { rendered: string } }[];

  return (
    <main>
      {b.map(({ id, title }) => (
        <div key={id}>
          <div>{id}</div>
          <div>{title?.rendered}</div>
        </div>
      ))}
    </main>
  );
};

export default Home;
