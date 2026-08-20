<?php
/**
 * Plugin Name: OD — footer widget area
 * Description: Re-registers the `sidebar_bottom` widget area the frontend footer reads, which was registered by the `welfare` theme and vanished with it.
 * Version:     1.0.0
 *
 * A **must-use** plugin, for the same reason as `od-profile.php`: the thing it
 * registers has to outlive the theme. The canonical copy is
 * `wp/mu-plugins/od-sidebars.php` in the od-frontend repo — edit it there and
 * re-upload, or the two drift.
 *
 * **Why this file exists.** `fetchFooter` reads
 * `GET /wp/v2/widgets?sidebar=sidebar_bottom`, and `sidebar_bottom` was one of
 * the eleven widget areas `welfare` registered. Deleting that theme (the step
 * that opened REST — see `prod-migration-runbook.md` §0.6) unregistered it, so
 * WordPress moved all 28 widget instances to `wp_inactive_widgets` and the
 * widgets endpoint stopped listing the four the footer renders. The instances
 * themselves survived — `widget_text` still holds their content, and
 * `theme_mods_welfare.sidebars_widgets.data` still records the old assignment
 * (`sidebar_bottom: text-4, text-2, text-3, text-5`), which is where the
 * re-assignment came from.
 *
 * **Registration here, assignment as data.** This file only declares the area;
 * which widgets sit in it is a row in the `sidebars_widgets` option, set once
 * with `wp widget move` (§0.6). A plugin that rewrote that option on every load
 * would fight the admin.
 *
 * The `id` is what matters and it is not ours to rename — the frontend queries
 * that exact string. Everything else is cosmetic: the area only ever renders
 * through REST, so no `before_widget` markup is worth carrying.
 *
 * PHP 7.0 syntax only: an mu-plugin loads on every request, including on hosts
 * still serving `mod_php7`.
 */

add_action( 'widgets_init', 'od_register_footer_sidebar' );

/**
 * The footer's widget area, under the id the frontend already asks for.
 */
function od_register_footer_sidebar() {
	register_sidebar(
		array(
			'id'          => 'sidebar_bottom',
			'name'        => 'Подвал сайта',
			'description' => 'Читается фронтендом через /wp/v2/widgets?sidebar=sidebar_bottom. Порядок виджетов здесь — порядок колонок в подвале.',
		)
	);
}
