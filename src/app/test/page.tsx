import { Button, Text } from '@radix-ui/themes';
import { Input } from '@/ui/components/input';
import { Link } from '@/ui/components/Link';

const Home = async () => (
  <main>
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

    <Input description="Input Default" tone="gray" message="Hint message goes here" rightIcon={1} />
    <Input description="Input Default" tone="red" message="Hint message goes here" />
  </main>
);

export default Home;
