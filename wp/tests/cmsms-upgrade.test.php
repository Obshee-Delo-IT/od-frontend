<?php
/**
 * Tests for `wp/plugins/cmsms-gutenberg-upgrade/` — the two security gates.
 *
 *     php wp/tests/cmsms-upgrade.test.php
 *
 * This suite reads the source rather than calling it. The other four suites stub
 * their way to a callable function; this file cannot, because the migrator is
 * 1363 lines that register hooks, a CLI command and an admin page at load time —
 * stubbing that surface would cost more than the code under test and would drift
 * the moment the plugin grows a hook. What actually has to hold is structural and
 * reads fine off the text: every `wp_ajax_` handler opens with the capability and
 * nonce gate, and the one query built from `$_POST` binds its filter instead of
 * interpolating it.
 *
 * Both were live holes on od-stage. `get_posts_pages()` concatenated
 * `$_POST['tag']` into a `LIKE` clause — passing that string to `$wpdb->prepare()`
 * escapes the *arguments*, never SQL text already inside the query — and no
 * handler checked a capability at all, so `admin-ajax.php` ran the site-wide
 * content rewrites for any logged-in Subscriber. Neither failure is visible from
 * the admin screen, which is why they are asserted here.
 *
 * @package od-frontend
 */

declare(strict_types=1);

require __DIR__ . '/harness.php';

$pluginDir = dirname(__DIR__) . '/plugins/cmsms-gutenberg-upgrade';
$plugin = file_get_contents($pluginDir . '/cmsms-gutenberg-upgrade.php');
$adminPage = file_get_contents($pluginDir . '/pages/cmsms-gutenberg-admin-page.php');

od_test('plugin source is readable', is_string($plugin) && $plugin !== '');
od_test('admin page source is readable', is_string($adminPage) && $adminPage !== '');

//-- The gate itself ------------------------------------------------------

od_test(
    'the guard requires manage_options',
    strpos($plugin, "if ( ! current_user_can( 'manage_options' ) ) {") !== false
);

od_test(
    'the guard verifies the nonce the admin page mints',
    strpos($plugin, "check_ajax_referer( 'nv-plugin' )") !== false
        && strpos($adminPage, "wp_create_nonce('nv-plugin')") !== false
);

//-- Every handler passes through it --------------------------------------

/**
 * The registrations are the authority, not a hand-kept list: a handler added
 * later is caught here rather than shipping unguarded. Anchored to the line
 * start so the commented-out `wp_ajax_nopriv_` registration stays out.
 */
preg_match_all("/^add_action\('wp_ajax_[a-z_]+',\s*'([a-z_]+)'\);/m", $plugin, $found);
$handlers = $found[1];

od_test('every wp_ajax_ registration was found', count($handlers) === 8);

foreach ($handlers as $handler) {
    od_test(
        "{$handler}() calls the guard first",
        strpos($plugin, "function {$handler}() {\n    nv_gu_check_ajax_access();") !== false
    );
}

//-- The SQL filter is bound ----------------------------------------------

od_test(
    'the tag filter is a placeholder',
    strpos($plugin, "\$where = 'AND post_content LIKE %s';") !== false
);

od_test(
    'the id filter is a placeholder',
    strpos($plugin, "\$where = 'AND ID = %d';") !== false
);

od_test(
    'no $_POST value is interpolated into a LIKE clause',
    strpos($plugin, 'LIKE \'%{$_POST') === false
);

od_test(
    'no $_POST value is concatenated onto a WHERE fragment',
    preg_match('/\$where\s*=\s*[^;]*\$_POST/', $plugin) === 0
);

/**
 * `{$where}` sits ahead of `LIMIT %d OFFSET %d`, so its argument has to be
 * prepended — `prepare()` binds positionally and a swapped pair would filter by
 * the page size.
 */
od_test(
    'the filter argument is bound ahead of LIMIT/OFFSET',
    strpos($plugin, 'array_merge($where_args, array($per_page, $offset))') !== false
);

od_test(
    'the COUNT query is prepared whenever it carries an argument',
    strpos($plugin, '$total = $where_args ? $wpdb->get_var($wpdb->prepare($total_sql, $where_args))') !== false
);

//-- The browser actually sends the nonce ---------------------------------

od_test(
    'the request builder attaches the nonce',
    strpos($adminPage, "p.set('_ajax_nonce', nonce);") !== false
);

od_test(
    'no request bypasses that builder',
    substr_count($adminPage, 'new URLSearchParams({') === 0
);

od_test_summary();
