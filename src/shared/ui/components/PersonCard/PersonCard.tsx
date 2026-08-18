import Image from 'next/image';
import {
  BaseIconProps,
  EmailIcon,
  PhoneCallIcon,
  TelegramIcon,
  UserIcon,
  VkOutlineIcon,
} from '@/shared/ui/components/Icons';
import css from './PersonCard.module.css';

/** The four contact shapes a `profile` record's body actually links. */
export type PersonContactKind = 'phone' | 'email' | 'telegram' | 'vk';

export interface PersonContact {
  kind: PersonContactKind;
  /** `tel:` / `mailto:` / an absolute `https:` URL — taken from the record, not built here. */
  href: string;
  /** What the record showed: a formatted number, an `@handle`, a bare URL. */
  label: string;
}

export interface PersonPhoto {
  src: string;
  alt: string;
}

export interface PersonCardProps {
  name: string;
  /** The role or region line under the name — one field, whichever the record has. */
  subtitle?: string | null;
  /**
   * Optional, and it is what selects the layout: with a photo the card is the
   * `team-1` card (photo beside the text, name in ink at 22), without one it is
   * the `handbooks` contact banner (a `User` glyph in the photo's place, name in
   * red at 18). Figma draws these as separate frames; they are one card with one
   * field filled or empty.
   */
  photo?: PersonPhoto | null;
  contacts?: PersonContact[];
}

const CONTACT_ICONS: Record<PersonContactKind, React.FC<BaseIconProps>> = {
  phone: PhoneCallIcon,
  email: EmailIcon,
  telegram: TelegramIcon,
  vk: VkOutlineIcon,
};

/**
 * One person, as `profile` records hold them — Figma `Frame 33928` (the contact
 * banner on `handbooks`) and the `team-1` / `team-2` cards, which are the same
 * card with the photo field filled.
 *
 * White, 12px radius, 20px padding, no border and no shadow anywhere in the
 * mocks. The contact rows are `[24px outline icon] 12 [red 18px link]` on a 6px
 * gap and sit at the bottom of the text column, which is what `margin-top: auto`
 * does here — Figma draws `space-between` on the photo card and a bottom anchor
 * on the wide one, and those are the same thing once the column can grow.
 *
 * `tel:`, `mailto:` and the social URLs are plain `<a>`s on purpose: the shared
 * `Link` wraps `next/link`, which has nothing to prefetch for a non-`http`
 * scheme and an off-site host.
 */
export const PersonCard: React.FC<PersonCardProps> = ({ name, subtitle, photo, contacts = [] }) => (
  <article className={photo ? `${css.card} ${css.withPhoto}` : css.card}>
    {photo ? (
      <div className={css.photo}>
        {/* `fill`, because the source images are arbitrary crops of arbitrary
            sizes — the box is the 200×259 the mock draws and the picture covers it. */}
        <Image src={photo.src} alt={photo.alt} fill sizes="(max-width: 900px) 80px, 200px" />
      </div>
    ) : null}
    <div className={css.body}>
      <div className={css.identity}>
        {/* The glyph stands in for the photo *in the contact row*, not in the
            photo's place: it shares the 24 + 12 indent the contact rows below
            use, which is what lines the whole block up in Figma. */}
        {photo ? null : <UserIcon size={24} className={css.contactIcon} aria-hidden />}
        <div className={css.names}>
          <p className={css.name}>{name}</p>
          {subtitle ? <p className={css.subtitle}>{subtitle}</p> : null}
        </div>
      </div>
      {contacts.length > 0 ? (
        <ul className={css.contacts}>
          {contacts.map(({ kind, href, label }) => {
            const Icon = CONTACT_ICONS[kind];
            return (
              <li key={href} className={css.contact}>
                {/* Decorative: the link beside it already says what the row is,
                    so a screen reader announcing «изображение» first would only
                    add noise. */}
                <Icon size={24} className={css.contactIcon} aria-hidden />
                <a href={href}>{label}</a>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  </article>
);
