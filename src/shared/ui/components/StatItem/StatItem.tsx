import css from './StatItem.module.css';

export interface StatItemProps {
  value: string | number;
  label: string;
  suffix?: string;
  illustration?: React.ReactNode;
}

export const StatItem = ({ value, label, suffix = '+', illustration }: StatItemProps) => (
  <div className={css.root}>
    {illustration ? <div className={css.illustration}>{illustration}</div> : null}
    <span className={css.value}>
      {value}
      <span className={css.suffix}>{suffix}</span>
    </span>
    <span className={css.label}>{label}</span>
  </div>
);
