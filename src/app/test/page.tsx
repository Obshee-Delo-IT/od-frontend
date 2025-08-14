import { HeaderServer } from '@/modules/Header';
import { Link } from '@/ui/components/Link';

const Home = async () => (
  <main>
    <HeaderServer />
    <Link href="fds">fds</Link>
    <div style={{ height: '200vh' }} />
  </main>
);

export default Home;
