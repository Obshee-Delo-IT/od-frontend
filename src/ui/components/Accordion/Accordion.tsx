import {
  AccordionContent,
  AccordionItem,
  AccordionMultipleProps,
  AccordionSingleProps,
  AccordionTrigger,
  Root,
} from '@radix-ui/react-accordion';
import clsx from 'clsx';
import ChevronDownIcon from '@/ui/assets/icons/chevron-down.svg';
import css from './Accordion.module.css';
import { Link } from '../Link';

type AccordionProps = AccordionSingleProps | AccordionMultipleProps;

export const Accordion: React.FC<AccordionProps> = (props) => (
  <Root {...props} className={clsx(css.root, props.className)}>
    <AccordionItem className={css.item} value="1">
      <AccordionTrigger className={css.trigger}>
        <Link href="fds" size="3">
          Is it accessible?
        </Link>
        <ChevronDownIcon className={css.icon} />
      </AccordionTrigger>
      <AccordionContent className={css.content}>Yes. It adheres to the WAI-ARIA design pattern.</AccordionContent>
    </AccordionItem>
    <AccordionItem className={css.item} value="2">
      <AccordionTrigger className={css.trigger}>Is it accessible?</AccordionTrigger>
      <AccordionContent className={css.content}>Yes. It adheres to the WAI-ARIA design pattern.</AccordionContent>
    </AccordionItem>
  </Root>
);
