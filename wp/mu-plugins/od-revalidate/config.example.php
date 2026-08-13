<?php
/**
 * Template for `wp-content/mu-plugins/od-revalidate/config.php` on the server.
 *
 * The real file is **not** in this repo and must not be: it holds the shared
 * secret. Copy this, fill it in, upload it with `chmod 600`, and leave
 * `wp-config.php` alone — a rotation then touches one small file that nothing
 * else on the install reads.
 *
 * Setting the same constants in `wp-config.php` works too; the guards below
 * mean whichever is defined first wins.
 *
 * @package od-frontend
 */

defined( 'ABSPATH' ) || exit;

// Trailing slash required — the frontend runs with trailingSlash: true.
defined( 'OD_REVALIDATE_URL' ) || define( 'OD_REVALIDATE_URL', 'https://<frontend-host>/api/revalidate/' );

// Must equal REVALIDATE_SECRET on that same deployment. One secret per tier.
defined( 'OD_REVALIDATE_SECRET' ) || define( 'OD_REVALIDATE_SECRET', '<paste the tier secret>' );

// Uncomment to wait for the response and log it to wp-content/debug.log.
// Diagnostics only: it puts the frontend's latency in front of the editor.
// defined( 'OD_REVALIDATE_DEBUG' ) || define( 'OD_REVALIDATE_DEBUG', true );
