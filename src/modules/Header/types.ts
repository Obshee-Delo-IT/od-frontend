export type SourceNavItem = {
  id: number;
  parent: number;
  url: string;
  title: { rendered: string };
};

export type NavItemProps = {
  href: string;
  id: number;
  text: string;
  parent: number;
};

export type ResultNavItem = {
  id: number;
  parent: number;
  href: string;
  text: string;
  content: NavItemProps[];
};
