export type SourceNavItem = {
  id: number;
  parent: number;
  url: string;
  title: { rendered: string };
};

export type NavItem = {
  id: number;
  parent: number;
  href: string;
  text: string;
  content: NavItem[];
};
