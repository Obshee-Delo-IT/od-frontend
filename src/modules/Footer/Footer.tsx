import { Container, IconButton } from '@radix-ui/themes';
import { OdnoklassnikiIcon, VkIcon, YoutubeIcon } from '@/ui/components/Icons';
import { Logo } from '@/ui/components/Logo';
import css from './Footer.module.css';

export const Footer = () => (
  <div className={css.footer}>
    <Container size="4" className={css.container}>
      <div className={css.navigation}>
        <div className={css.socials}>
          <Logo size="lg" className={css.logo} />
          <IconButton variant="classic" className={css.social}>
            <VkIcon />
          </IconButton>
          <IconButton variant="classic" className={css.social}>
            <OdnoklassnikiIcon />
          </IconButton>
          <IconButton variant="classic" className={css.social}>
            <YoutubeIcon />
          </IconButton>
        </div>
        <div className={css.contacts}>
          <p className={css.sectionName}>КОНТАКТЫ РЕДАКЦИИ</p>
          <p className={css.sectionLink}>Главный редактор: Дегтярев А.А.</p>
          <p className={css.sectionLink}>Эл.почта: web@obshee-delo.ru</p>
          <p className={css.sectionLink}>Телефон: +7 (962) 950-75-61</p>
        </div>

        <div className={css.reviews}>
          <p className={css.sectionName}>ОТЗЫВЫ</p>
          <p className={css.sectionLink}>Письма и отзывы</p>
          <p className={css.sectionLink}>СМИ о нас</p>
          <p className={css.sectionLink}>Экспертные заключения</p>
          <p className={css.sectionLink}>Наши партнеры</p>
          <p className={css.sectionLink}>Оставить отзыв</p>
          <p className={css.sectionLink}>Предложить идею</p>
        </div>

        <div>
          <p className={css.sectionName}>ССЫЛКИ</p>
          <p className={css.sectionLink}>О нас</p>
          <p className={css.sectionLink}>Наши дела</p>
          <p className={css.sectionLink}>Наши фильмы</p>
          <p className={css.sectionLink}>Прими участие</p>
          <p className={css.sectionLink}>Наши материалы</p>
          <p className={css.sectionLink}>Карта сайта</p>
          <p className={css.sectionLink}>Частые вопросы</p>
          <p className={css.sectionLink}>Благотворительная акция</p>
        </div>
      </div>
      <span className={css.line} />
      <div className={css.info} />
    </Container>
  </div>
);
