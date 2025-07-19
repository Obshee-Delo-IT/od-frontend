import { Button, Text } from '@radix-ui/themes';
import { Link } from '@/ui/components/Link';

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
      <Button size="1">Button</Button>
      <Button size="2">Button</Button>
      <Button size="3">Button</Button>
      <Button size="4">Button</Button>

      <Link href="fsdd">fdsfds</Link>
      <Link href="fsdd" color="white" leftIcon={1} rightIcon={2}>
        fds
      </Link>

      <div>
        <Text size="9">9</Text>
        <Text size="8">8</Text>
        <Text size="7">7</Text>
        <Text size="6">6</Text>
        <Text size="5">5</Text>
        <Text size="4">4</Text>
        <Text size="3">3</Text>
        <Text size="2">2</Text>
        <Text size="1">1</Text>
      </div>
    </main>
  );
};

export default Home;
