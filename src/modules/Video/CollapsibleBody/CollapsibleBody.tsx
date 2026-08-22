'use client';

import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/shared/ui/components/Button';
import css from './CollapsibleBody.module.css';

interface CollapsibleBodyProps {
  children: React.ReactNode;
  /** Height the content is clamped to while collapsed. */
  collapsedHeight?: number;
  className?: string;
}

/**
 * Clamps the long film description/transcript behind a «Развернуть» button
 * (Figma `Frame 33946`). Content is always in the DOM (SEO/find-in-page work
 * once expanded); short bodies unclamp themselves after mount.
 */
export const CollapsibleBody: React.FC<CollapsibleBodyProps> = ({ children, collapsedHeight = 760, className }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  // Collapsed-with-button is the SSR default; drop the clamp when the content
  // turns out to fit (roughly — a button-height of slack avoids clamping off
  // less than the toggle itself occupies).
  const [collapsible, setCollapsible] = useState(true);

  useEffect(() => {
    const content = contentRef.current;
    if (content && content.scrollHeight <= collapsedHeight + 72) {
      setCollapsible(false);
    }
  }, [collapsedHeight]);

  const collapsed = collapsible && !expanded;

  return (
    <div className={className}>
      <div
        ref={contentRef}
        className={clsx(css.content, collapsed && css.collapsed)}
        style={collapsed ? { maxHeight: collapsedHeight } : undefined}
      >
        {children}
      </div>
      {collapsible ? (
        <Button variant="outline" className={css.toggle} onClick={() => setExpanded((value) => !value)}>
          {expanded ? 'Свернуть' : 'Развернуть'}
        </Button>
      ) : null}
    </div>
  );
};
