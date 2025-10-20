import {
  AccordionContent,
  AccordionItem,
  AccordionMultipleProps,
  AccordionSingleProps,
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
}

type AccordionProps = (AccordionSingleProps | AccordionMultipleProps) & {
  items: AccordionItemData[];
};

export const Accordion: React.FC<AccordionProps> = ({ items, ...props }) => (
  <Root {...props} className={clsx(css.root, props.className)}>
    {items.map(({ content, href, text, value }) => (
      <AccordionItem key={value} className={css.item} value={`${value}`}>
        <AccordionTrigger className={css.trigger}>
          {href ? (
            <Link href={href} size="3" color="gray">
              {text}
            </Link>
          ) : (
            <Text size="3" color="gray">
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
