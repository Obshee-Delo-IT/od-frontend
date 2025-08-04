import { Button, IconButton, Text } from '@radix-ui/themes';
import HexagonIcon from '@/ui/assets/icons/hexagon.svg';
import InfoIcon from '@/ui/assets/icons/info.svg';
import { Accordion } from '@/ui/components/Accordion';
import { ButtonGroup } from '@/ui/components/ButtonGroup';
import { MenuIcon, SearchIcon, WarningIcon, CrossCircleFilledIcon } from '@/ui/components/Icons';
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
      error
    />

    <Input
      placeholder="Input Default"
      color="red"
      message="Hint message goes here"
      leftIcon={<HexagonIcon />}
      rightIcon={<InfoIcon />}
      label="Label goes here"
      error
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

    <Accordion
      type="multiple"
      items={[
        { value: 1, text: 'TEST', content: <div>123</div> },
        { value: 2, text: 'sss', href: 'fdssd', content: <div>32322</div> },
      ]}
    />

    <IconButton variant="solid">
      <MenuIcon />
    </IconButton>
    <MenuIcon color="purple" />
    <MenuIcon color="var(--red-7)" size={40} />
    <SearchIcon size={84} color="black" />
    <IconButton variant="outline">
      <SearchIcon />
    </IconButton>
    <IconButton variant="outline">
      <WarningIcon />
    </IconButton>
    <IconButton variant="outline" radius="medium">
      <CrossCircleFilledIcon />
    </IconButton>
  </main>
);

export default Home;
