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
          <p className={css.sectionLink}>
            Экспертные
            <br className={css.break} /> заключения
          </p>
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
          <p className={css.sectionLink}>
            Благотворительная
            <br className={css.break} /> акция
          </p>
        </div>
      </div>
      <span className={css.line} />
      <div />

      <div className={css.info}>
        <div>
          <p>Средство массовой информации:</p>
          <p>Сетевое издание &quot;ОБЩЕЕ ДЕЛО&quot;</p>
          <p className={css.underlined}>
            Зарегистрировано Роскомнадзором, свидетельство Эл № ФC77-72346 от 14 февраля 2018
          </p>
        </div>

        <div>
          <p>Учредитель:</p>
          <p>Учётный номер в реестре НКО №0012011716</p>
          <p>Общероссийская общественная организация &quot;Общее дело&quot;</p>
          <p>ОГРН: 1127799010624</p>
        </div>

        <div>
          <p>При перепечатывании материалов ссылка на издание обязательна. 12+</p>
          <p className={css.underlined}>Политика конфиденциальности</p>
        </div>
      </div>
    </Container>
  </div>
);
