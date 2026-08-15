/**
 * Feature switches for UI that exists but must not ship yet.
 */

/**
 * The newsletter signup form (`modules/NewsletterSignup`), rendered at the foot
 * of the home page, every index and the news article sidebar.
 *
 * **Off until the Unisender integration is built.** The form is complete but
 * its submit handler does nothing (issue #54): a visitor who types an address
 * and clicks «Подписаться» gets no subscription, no confirmation mail and no
 * error — worse than not offering it. WordPress must not be put back in that
 * path either; the legacy MailPoet 2 install can't deliver mail at all.
 *
 * Turn this on only once `docs/newsletter-unisender.md` is implemented —
 * server-side `subscribe` call with `double_optin=3`, rate limiting, and the
 * consent text stored with the submission.
 */
export const NEWSLETTER_SIGNUP_ENABLED = false;
