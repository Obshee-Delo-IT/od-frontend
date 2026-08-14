import AddOutlined from '@/shared/ui/assets/icons/add-outlined.svg';
import ArrowRight from '@/shared/ui/assets/icons/arrow-right.svg';
import ChevronLeft from '@/shared/ui/assets/icons/chevron-left.svg';
import ChevronRight from '@/shared/ui/assets/icons/chevron-right.svg';
import CirclePlay from '@/shared/ui/assets/icons/circle-play.svg';
import Cross from '@/shared/ui/assets/icons/cross.svg';
import Download from '@/shared/ui/assets/icons/download.svg';
import Menu from '@/shared/ui/assets/icons/menu.svg';
import Odnoklassniki from '@/shared/ui/assets/icons/odnoklassniki.svg';
import Search from '@/shared/ui/assets/icons/search.svg';
import Vk from '@/shared/ui/assets/icons/vk.svg';
import Youtube from '@/shared/ui/assets/icons/youtube.svg';

/**
 * Typed icons — one line each.
 *
 * `@svgr/webpack` (see `turbopack.rules` in `next.config.ts`) already turns
 * every `.svg` in `assets/icons/` into a component that takes `className`,
 * `color`, `width`, `height` and a `ref`. All these wrappers add is the square
 * `size` prop and its default, which is why they are one file rather than
 * twenty: there was a file, a props interface and a barrel entry per icon, and
 * seven of them had no call site at all.
 *
 * Adding an icon: drop the SVG in `assets/icons/` and add a line here. Skipping
 * that is fine too — `Accordion`, `ButtonGroup` and `Breadcrumbs` import the
 * SVG directly, because they size theirs in CSS.
 */
export interface BaseIconProps extends Omit<React.SVGProps<SVGElement>, 'width' | 'height'> {
  /** Square edge, in pixels. */
  size?: number;
}

/** 20px unless the call site says otherwise — every non-social icon is drawn square at 20. */
export const AddOutlinedIcon: React.FC<BaseIconProps> = ({ size = 20, ...props }) => (
  <AddOutlined width={size} height={size} {...props} />
);
export const ArrowRightIcon: React.FC<BaseIconProps> = ({ size = 20, ...props }) => (
  <ArrowRight width={size} height={size} {...props} />
);
export const ChevronLeftIcon: React.FC<BaseIconProps> = ({ size = 20, ...props }) => (
  <ChevronLeft width={size} height={size} {...props} />
);
export const ChevronRightIcon: React.FC<BaseIconProps> = ({ size = 20, ...props }) => (
  <ChevronRight width={size} height={size} {...props} />
);
export const CirclePlayIcon: React.FC<BaseIconProps> = ({ size = 20, ...props }) => (
  <CirclePlay width={size} height={size} {...props} />
);
export const CrossIcon: React.FC<BaseIconProps> = ({ size = 20, ...props }) => (
  <Cross width={size} height={size} {...props} />
);
export const DownloadIcon: React.FC<BaseIconProps> = ({ size = 20, ...props }) => (
  <Download width={size} height={size} {...props} />
);
export const MenuIcon: React.FC<BaseIconProps> = ({ size = 20, ...props }) => (
  <Menu width={size} height={size} {...props} />
);
export const SearchIcon: React.FC<BaseIconProps> = ({ size = 20, ...props }) => (
  <Search width={size} height={size} {...props} />
);

/** The three social marks are drawn at 30, in the footer and only there. */
export const OdnoklassnikiIcon: React.FC<BaseIconProps> = ({ size = 30, ...props }) => (
  <Odnoklassniki width={size} height={size} {...props} />
);
export const VkIcon: React.FC<BaseIconProps> = ({ size = 30, ...props }) => (
  <Vk width={size} height={size} {...props} />
);
export const YoutubeIcon: React.FC<BaseIconProps> = ({ size = 30, ...props }) => (
  <Youtube width={size} height={size} {...props} />
);
