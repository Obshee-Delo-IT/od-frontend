import { Button, Text } from '@radix-ui/themes';
import HexagonIcon from '@/ui/assets/icons/hexagon.svg';
import InfoIcon from '@/ui/assets/icons/info.svg';
import { ButtonGroup } from '@/ui/components/ButtonGroup';
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

    <Input
      placeholder="Input Default"
      color="gray"
      message="Hint message goes here"
      leftIcon={<HexagonIcon />}
      rightIcon={<InfoIcon />}
      label="Label goes here"
      disabled
    />

    <Input
      placeholder="Input Default"
      color="red"
      message="Hint message goes here"
      leftIcon={<HexagonIcon />}
      rightIcon={<InfoIcon />}
      label="Label goes here"
      disabled
    />

    <ButtonGroup
      items={[
        { href: 'fd', id: 1, text: 'ffffffff' },
        {
          href: 'fdsfds',
          id: 2,
          text: 'bbbbbbbbb',
          content: [
            {
              href: 'bbb',
              id: 1,
              text: 'hehe',
            },
          ],
        },
      ]}
    />
  </main>
);

export default Home;
