'use client';

import clsx from 'clsx';
import { useRouter } from 'next/navigation';
import { Dropdown } from '@/shared/ui/components/Dropdown';
import { Tabs } from '@/shared/ui/components/Tabs';
import css from './VideoFilter.module.css';

export interface VideoFilterOption {
  label: string;
  /** Stable key matched against `active` (e.g. «all», «movies»). */
  value: string;
  /** Precomputed destination (built server-side so this stays serializable). */
  href: string;
}

interface VideoFilterProps {
  options: VideoFilterOption[];
  active: string;
  className?: string;
}

/**
 * Category switcher for the catalogue: a «Подобрать фильм по теме»
 * {@link Dropdown} on desktop, the {@link Tabs} strip on mobile (toggled by
 * CSS). Both navigate to the option's precomputed href, which is the category's
 * own page — `/video/multy/`, not `/video/?category=mult`.
 */
export const VideoFilter: React.FC<VideoFilterProps> = ({ options, active, className }) => {
  const router = useRouter();
  const hrefByValue = new Map(options.map((option) => [option.value, option.href]));

  return (
    <div className={clsx(css.root, className)}>
      <div className={css.desktop}>
        <Dropdown
          label="Подобрать фильм по теме"
          options={options.map(({ label, value }) => ({ label, value }))}
          value={active}
          onValueChange={(value) => {
            const href = hrefByValue.get(value);
            if (href) {
              router.push(href);
            }
          }}
        />
      </div>

      <div className={css.mobile}>
        <Tabs
          items={options.map(({ label, value, href }) => ({ label, value, href }))}
          activeValue={active}
          size="small"
          aria-label="Категории фильмов"
        />
      </div>
    </div>
  );
};
