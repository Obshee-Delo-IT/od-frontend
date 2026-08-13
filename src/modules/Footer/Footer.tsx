import { Fragment } from 'react';
import { resolveContentImages } from '@/modules/News/utils/resolveContentImages';
import { fetchFooter } from '@/shared/api';
import css from './Footer.module.css';
import { renderFooterWidget } from './utils/renderFooterWidget';

/**
 * Figma `footer` (`838:1631`) with its `footer-1200` (`1621:15559`),
 * `footer-900` (`1621:15660`) and `footer-mob` (`1261:7985`) variants.
 *
 * The content stays what it has always been — the widgets in WordPress's
 * `sidebar_bottom`, in order — so editors keep owning the links. Only the
 * presentation is the Figma component: a 1240 column of four columns that
 * folds to three (with the logo on its own row) below 1200 and stacks below
 * 900, with the two link columns sitting side by side on mobile.
 */
export const Footer = async () => {
  const { data } = await fetchFooter();

  // The widget markup carries the WordPress logo straight from the origin,
  // which is slow and 301s; every other image on the site goes through the
  // resolution pipeline, so this one does too.
  const widgets = await Promise.all(
    (data ?? []).map(async (block) => ({
      id: block.id,
      html: block.rendered ? await resolveContentImages(block.rendered) : '',
    }))
  );

  return (
    <footer className={css.footer} id="footer">
      <div className={css.inner}>
        <div className={css.footerWrap}>
          {widgets.map((widget) => (
            <Fragment key={widget.id}>{!!widget.html && renderFooterWidget(widget.html, css.socialLink)}</Fragment>
          ))}
        </div>
      </div>
    </footer>
  );
};
