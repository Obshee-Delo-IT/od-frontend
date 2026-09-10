# Suggestions from the demo, and what each would cost

Five people were given `https://new.obshee-delo.ru` in late August 2026 and sent
back what they found: **Р. Низамов** (a document, 27.08), **А. Панфёрова**
(Telegram, 25–27.08), **Д. Чагаев** (Telegram, 25.08), **О. Баранова** (VK) and
**Е. Чернов** (e-mail to `news@`, 28.08). The **defects** they reported are
tracked where defects belong — fixed in place, or an entry in
[`next-steps.md`](./next-steps.md). This file holds the other half: the things
that are not broken, that somebody asked for anyway.

Nothing here is scheduled. Each entry says who asked, what it would take, and —
where there is one — the cheapest version that would answer the request.

Two of them arrived twice, from people who had not spoken to each other. That is
the strongest signal in the whole batch, and they are the first two below.

---

## 1. Group the films by subject, and give the phone horizontal rails

**Asked by А. Панфёрова and О. Баранова, independently.**

> «В разделе Фильмы сложно ориентироваться. Лучше упорядочить по смыслу. […] В
> телефоне вертикальная лента, хорошо бы как в онлайн-кинотеатрах — когда
> несколько горизонтальных лент по темам.» (Панфёрова, with a screenshot of an
> online cinema's home screen.)

> «Я бы фильмы поставила друг за другом по смысловой нагрузке — алкоголь,
> никотин, наркотики, мотивация. А то всё вперемешку, даже я путаюсь. Если
> зайдёт преподаватель — всех нужных видео может не найти, они широко
> разбросаны.» (Баранова, who is a regional coordinator.)

Both describe the same gap and both name the same audience: a teacher who needs
*the film about smoking*, not the newest film. `/video/` today is one grid
ordered by date, filtered only by the four format categories
(`FILM_CATEGORIES` — «Фильмы», «Мультфильмы», «Ролики», «Известные люди»),
which say what a film *is* and never what it is *about*.

**What it needs, in order.** The taxonomy first: subject tags on 85 films
(алкоголь, табак, наркотики, мотивация, …), which is editorial work nobody has
started — a film often has two or three, and Панфёрова was told as much during
the exchange, which is what turned the request from tags into rails. Then the
routes: either a tag filter beside the existing category chips (cheap, one more
query parameter, no new page) or the rails — one horizontal strip per subject on
`/video/`, which is a new layout, and on a phone a horizontally scrolling one.

**Cheapest version that answers it:** the tag chips. A strip layout without tags
is impossible; tags without a strip already let a teacher find every film about
smoking in one click.

**Cost:** editorial tagging of 85 films (hours, not minutes, and it is not
ours) + a day for the filter, or several for the rails. Nothing in the data
layer blocks either — `fetchFilms` already takes category ids and would take
tag ids the same way.

## 2. The illustrations look unserious for the organisation

**Asked by А. Панфёрова and Е. Чернов, independently — and Чернов says he polled
the board.**

> «Мне не очень нравятся картинки с людьми без лиц. Мне кажется „Общее дело“ —
> это организация с человеческим лицом. А они бездушные что-ли… Мне больше
> нравится или живое фото, или рисунок, но без людей.» (Панфёрова, pointing at
> the programme cards.)

> «Мнение о дизайне картинок на сайте. Советовался с некоторыми членами
> правления, у них такое же впечатление. С таким дизайном картинок сайт
> выглядит менее солидно. Не соответствует статусу „Общероссийской общественной
> организации поддержки президентских инициатив в области здоровьесбережения
> нации“. […] Ассоциация посетителя сайта должна быть, как сайт серьёзной
> госорганизации.» (Чернов.)

This is the flat vector illustration set the design uses for the three programme
cards and the section headers — faceless figures, thin lines, pastel accents.
Two people who were shown the site separately arrived at the same word for it,
and one of them checked with the board first.

**It is not a code question.** The illustrations are assets in
`src/shared/ui/assets/`, referenced by a handful of components; swapping the set
is an afternoon. Choosing what replaces it is the whole cost, and it belongs to
whoever owns the visual direction — photographs of real events (the archive is
large and it is what the organisation actually looks like), or non-figurative
graphics, are the two directions the feedback points at.

**Worth noting against it:** the illustration set is what
[`design-system.md`](./design-system.md) and the Figma file are built on, and
the mocks were signed off with it. This is a request to revisit a settled
decision, from two of five reviewers — including the reviewer who speaks for the
board. Put it to the designer as a question
([`questions-for-designer.md`](./questions-for-designer.md)), don't
quietly re-skin.

## 3. A way back from the donation site

**Asked by А. Панфёрова.**

> «Я так поняла, что раздел „Оказать помощь“ ведёт на отдельный сайт. Пыталась
> потом вернуться обратно. Хорошо бы, чтобы там была какая-то ссылка для этого.»

«Оказать помощь» in the header and the home hero both point at
`https://поддержи.общее-дело.рф/`, a separate Leyka install. It has no link
back. The fix is one link **on that site**, not on this one — which is why it is
here and not in `next-steps.md`: this repo cannot ship it. Same visit produced
two real defects on that site (pre-ticked consent boxes, document links that go
nowhere), tracked in `next-steps.md`.

**Cost:** minutes, on a site this project does not deploy.

## 4. Transcripts on every film page

**Asked by Е. Чернов.**

> «Сохранённая транскрибация тоже очень помогает в публикациях. Если её добавить
> во все фильмы, будет ещё более удобно.»

The audience is the organisation's own activists writing posts about a film, not
visitors. Mechanically this is the cheapest item on the list: ACF's
`group_film_meta` already has 18 fields and one more long-text field costs
nothing, `FilmPage` can render it behind a `<details>`, and the content can be
produced by any speech-to-text pass over the Kinescope masters.

**Cost:** a field + a collapsible block (half a day) + transcription of 85 films
(machine time, then editorial cleanup). It also has an SEO side effect worth
having: a film page today carries almost no indexable text.

## 5. A «Отзывы о нас» section, with the teachers' video testimonials

**Asked by Е. Чернов, who offers to collect the material.**

> «Если это возможно, предложение — добавил бы раздел „отзывы о нас“, у нас уже
> есть много видео отзывов педагогов. А это наша основная целевая аудитория. […]
> Таких видео отзывов более 10. Если получится, соберу ссылки на публикации,
> фото/видео.»

The site has `/about/reviews/` («Благодарственные письма и отзывы» — scans of
letters) and `/about/activist-stories/` (25 clips by activists). Neither is
*teachers talking about the programme*, which is the audience the organisation
sells to.

**Note the overlap:** those 25 existing clips are on YouTube and not on
Kinescope, which is already an open item in `next-steps.md`. A new video section
would inherit exactly that problem, so it should be built *after* that upload
path exists, not before — otherwise the answer is a second page of embeds that
do not play for part of the audience.

**Cost:** a page shaped like `activist-stories` is small (it is a list of embeds
with a name and a quote); the material and the hosting are the work.

## 6. Regional отделения inside «Команда»

**Asked by А. Панфёрова.**

> «В Команде нет региональных отделений. Будут?»

`/team/` is the central apparatus (11 cards). The regions are on `/contacts/`
and on 75 pages under it, with their coordinators. So the information exists;
the question is whether «Команда» should be the place that leads to it.

**Cheapest version:** a line and a link at the foot of `/team/` — «Руководители
региональных отделений — на странице Контакты». Half an hour.

**The larger version** — a searchable roster of all coordinators — is a real
feature, and the data for it is uneven: eighteen branch cards state no way to
reach anybody (`next-steps.md`), so a roster would advertise the gaps.

## 7. A link to МАКС beside the other platforms

**Asked by Е. Чернов.**

> «Круто, что есть варианты ссылок на разные ресурсы. Если возможно и уместно,
> можно и на МАКС тоже ссылку сделать. Сейчас все педагоги и дети в МАКС.
> Алексей сделал страничку с фильмами.»

The film page has a share/watch row built from `sharePlatforms.ts` (VK, YouTube,
Rutube as raster brand marks) and ACF `share_*` fields. Adding a platform is one
more entry there, one icon, and one ACF field — the pattern is already
generic.

**Cost:** an hour of code. Then the per-film links have to be filled in, which
is the same editorial bottleneck as B-VIDEO2.

## 8. Tidy the «Благодарственные письма и отзывы» layout

**Asked by Р. Низамов.**

> «В разделе „Благодарственные письма и отзывы“ можно улучшить визуальное
> отображение наименования и самой благодарности, выровнять.»

`/about/reviews/` is one of the 44 pages that pass through un-redesigned — a
`core/query` of letter scans with their titles, unaligned because nothing has
laid it out. It is a D-workstream page that never got a mock.

**Cost:** a grid and consistent thumbnail sizing — a day, and it needs a mock or
a decision to design it in place.

## 9. Check the interactive map is current

**Asked by Е. Чернов** («Интерактивная карта на прежнем сайте — очень радовала.
[…] Здорово, её сохранили. Надо проверять актуальность. Но это отдельный
вопрос.»)

He is right that it is a separate question, and it is already an open one:
`next-steps.md` records that **twelve regions on the map have no page and five
pages have no region**, and `pnpm map:generate` refuses to emit a link no page
answers for. What is missing is somebody going region by region — editorial,
not code.

---

## Not doing, and why

- **Reels and short vertical clips on the site** (Панфёрова: «не нашла рилсов,
  новых роликов про обезьян, видео Олега Моисеева про друзей»). Answered during
  the exchange: short social formats are not published as site material, and the
  editors send what they want on the site. If that changes it is an editorial
  decision, not a gap.
- **A separate index page for the films with covers and titles** (Панфёрова).
  That is what `/video/` already is — the request came from a phone, where the
  grid is one column, which is the same finding as item 1 above.
