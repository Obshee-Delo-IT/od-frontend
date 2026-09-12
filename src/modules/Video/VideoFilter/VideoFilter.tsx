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
 * The label both halves carry.
 *
 * It read «Подобрать фильм по теме» until 2026-09-12, and by then it was false:
 * this control selects Фильмы / Мультфильмы / Ролики / Короткометражные /
 * Известные люди, which is a **form**, not a theme — and the row directly under
 * it is now a real filter by theme ({@link TopicFilter}). Two controls, one of
 * them claiming the other's job.
 */
const CAPTION = 'Раздел';

/**
 * Category switcher for the catalogue: a labelled {@link Dropdown} on desktop,
 * the {@link Tabs} strip on mobile (toggled by CSS). Both navigate to the
 * option's precomputed href, which is the category's own page —
 * `/video/multy/`, not `/video/?category=mult`.
 *
 * The mobile half repeats the label as visible text because `Tabs` has no field
 * label of its own, and an unlabelled strip of chips above another unlabelled
 * strip of chips is unreadable.
 */
export const VideoFilter: React.FC<VideoFilterProps> = ({ options, active, className }) => {
  const router = useRouter();
  const hrefByValue = new Map(options.map((option) => [option.value, option.href]));

  return (
    <div className={clsx(css.root, className)}>
      <div className={css.desktop}>
        <Dropdown
          label={CAPTION}
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
        <span className={css.caption}>{CAPTION}</span>
        <Tabs
          items={options.map(({ label, value, href }) => ({ label, value, href }))}
          activeValue={active}
          size="small"
          aria-label={CAPTION}
        />
      </div>
    </div>
  );
};
