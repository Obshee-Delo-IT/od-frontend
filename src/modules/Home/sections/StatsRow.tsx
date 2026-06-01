import css from './StatsRow.module.css';

interface Stat {
  value: string;
  label: string;
  accent: 'green' | 'purple' | 'yellow' | 'blue';
}

const STATS: Stat[] = [
  { value: '12', label: 'лет работы', accent: 'green' },
  { value: '2500', label: 'волонтеров', accent: 'purple' },
  { value: '50', label: 'регионов', accent: 'yellow' },
  { value: '25', label: 'фильмов', accent: 'blue' },
];

export const StatsRow: React.FC = () => (
  <section aria-label="Статистика организации">
    <ul className={css.row}>
      {STATS.map((stat) => (
        <li key={stat.label} className={css.card}>
          <div className={css.number}>
            <span className={css.value}>{stat.value}</span>
            <span className={css.plus} data-accent={stat.accent}>
              +
            </span>
          </div>
          <p className={css.label}>{stat.label}</p>
        </li>
      ))}
    </ul>
  </section>
);
