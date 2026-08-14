import {
  AccordionContent,
  AccordionItem,
  AccordionMultipleProps,
  AccordionTrigger,
  Root,
} from '@radix-ui/react-accordion';
import { Text } from '@radix-ui/themes';
import clsx from 'clsx';
import { ReactNode } from 'react';
import ChevronDownIcon from '@/shared/ui/assets/icons/chevron-down.svg';
import css from './Accordion.module.css';
import { Link } from '../Link';

interface AccordionItemData {
  value: string | number;
  href?: string;
  text?: string;
  content?: ReactNode;
  /** Marks the row as the one the reader is currently on — the header's mobile menu uses it for the open section. */
  active?: boolean;
}

/**
 * `type="multiple"` only — the one caller (the mobile menu) opens each section
 * independently. Radix's single-open mode is one prop away if a FAQ ever wants it.
 */
type AccordionProps = AccordionMultipleProps & {
  items: AccordionItemData[];
};

export const Accordion: React.FC<AccordionProps> = ({ items, ...props }) => (
  <Root {...props} className={clsx(css.root, props.className)}>
    {items.map(({ content, href, text, value, active }) => (
      <AccordionItem key={value} className={css.item} value={`${value}`}>
        <AccordionTrigger className={css.trigger} aria-current={active ? 'page' : undefined}>
          {href ? (
            <Link href={href} size="3" color={active ? 'red' : 'primary'}>
              {text}
            </Link>
          ) : (
            <Text size="3" className={clsx(css.label, { [css.labelActive]: active })}>
              {text}
            </Text>
          )}
          <ChevronDownIcon className={css.icon} />
        </AccordionTrigger>
        <AccordionContent className={css.content}>{content}</AccordionContent>
      </AccordionItem>
    ))}
  </Root>
);
