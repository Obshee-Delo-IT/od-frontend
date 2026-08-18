<?php
/**
 * Plugin Name: OD — profile post type
 * Description: Owns the `profile` post type, its `pl-categs` taxonomy and the one post meta the frontend reads, so `cmsms-content-composer` can be removed.
 * Version:     1.0.0
 *
 * A **must-use** plugin: it lives in `wp-content/mu-plugins/`, so it cannot be
 * deactivated from the admin and it survives the headless theme swap. The
 * canonical copy is `wp/mu-plugins/od-profile.php` in the od-frontend repo —
 * edit it there and re-upload, or the two drift.
 *
 * **Why this file exists.** `cmsms-content-composer` registered `profile`,
 * `pl-categs` and the `cmsms_profile_subtitle` meta
 * (`inc/profile/profiles-posttype.php`), and that plugin is 20 000+ lines of
 * dead page-builder shipped with a theme we no longer use. The 205 `profile`
 * records are already clean Gutenberg, and the 75 regional coordinator lists
 * already run on core `wp:query` over this post type — so removing the plugin
 * costs no content migration, only these ~15 lines of registration. Registering
 * them here rather than in a theme's `functions.php` is deliberate: a post type
 * registered by a theme disappears the moment the theme changes, taking every
 * row out of the admin and out of REST with it.
 *
 * **The arguments are the ones cmsms actually had at runtime**, dumped from
 * `get_post_type_object()` / `get_taxonomy()` rather than copied from its
 * source, so filters are included. Two deliberate departures:
 *
 *   - `show_in_rest` on the **taxonomy**, which cmsms omitted — that is why
 *     `/wp-json/wp/v2/pl-categs` used to 404. Core `wp:query` filtered on it
 *     regardless (it only needs `public` + `publicly_queryable`).
 *   - Russian labels. cmsms shipped «Profiles» in an otherwise Russian admin.
 *
 * Everything else — the `profile` rewrite slug, `has_archive`, the supports
 * list, `menu_position` 52 — is byte-for-byte what was registered before,
 * because a difference there would move URLs or drop an editor's field.
 *
 * **Priority 20, not the default 10.** mu-plugins load before ordinary plugins,
 * so a callback added here runs *first* at a shared priority and cmsms would
 * re-register over it. Running later means this file wins while both are
 * installed, which is what makes the rollout verifiable: install, check REST
 * and the admin, and only then deactivate cmsms — at which point nothing
 * changes, because this was already the live registration.
 *
 * **The PHP here is deliberately old-fashioned** — no short array syntax on the
 * outer arrays, no arrow functions, no typed returns. An mu-plugin loads on
 * every request, and prod's site PHP is still 7.x (`mod_php7`), where newer
 * syntax is a parse error that would take the whole site down.
 *
 * @package od-frontend
 */

defined( 'ABSPATH' ) || exit;

add_action( 'init', 'od_profile_register', 20 );

/**
 * Register the post type, its taxonomy and the meta key the frontend reads.
 *
 * @return void
 */
function od_profile_register() {
	register_post_type(
		'profile',
		array(
			'labels'              => array(
				'name'                  => 'Профили',
				'singular_name'         => 'Профиль',
				'menu_name'             => 'Профили',
				'name_admin_bar'        => 'Профиль',
				'add_new'               => 'Добавить',
				'add_new_item'          => 'Добавить профиль',
				'edit_item'             => 'Редактировать профиль',
				'new_item'              => 'Новый профиль',
				'view_item'             => 'Посмотреть профиль',
				'view_items'            => 'Просмотр профилей',
				'search_items'          => 'Искать профили',
				'not_found'             => 'Профили не найдены',
				'not_found_in_trash'    => 'В корзине профилей нет',
				'all_items'             => 'Все профили',
				'archives'              => 'Все профили',
				'featured_image'        => 'Фотография',
				'set_featured_image'    => 'Задать фотографию',
				'remove_featured_image' => 'Удалить фотографию',
				'use_featured_image'    => 'Использовать как фотографию',
			),
			'public'              => true,
			'publicly_queryable'  => true,
			'exclude_from_search' => false,
			'show_ui'             => true,
			'show_in_menu'        => true,
			'show_in_nav_menus'   => true,
			'show_in_admin_bar'   => true,
			'show_in_rest'        => true,
			'hierarchical'        => false,
			'has_archive'         => true,
			'menu_position'       => 52,
			'menu_icon'           => 'dashicons-id',
			'capability_type'     => 'post',
			'map_meta_cap'        => true,
			'can_export'          => true,
			'rewrite'             => array(
				'slug'       => 'profile',
				'with_front' => true,
				'pages'      => true,
				'feeds'      => true,
			),
			// `trackbacks` and `comments` are in the list because they were, and a
			// support silently dropped is an editor's missing panel.
			'supports'            => array(
				'title',
				'editor',
				'thumbnail',
				'excerpt',
				'trackbacks',
				'custom-fields',
				'comments',
				'revisions',
				'page-attributes',
				'autosave',
			),
		)
	);

	register_taxonomy(
		'pl-categs',
		array( 'profile' ),
		array(
			'labels'             => array(
				'name'          => 'Регионы',
				'singular_name' => 'Регион',
				'menu_name'     => 'Регионы',
				'all_items'     => 'Все регионы',
				'edit_item'     => 'Редактировать регион',
				'view_item'     => 'Посмотреть регион',
				'update_item'   => 'Обновить регион',
				'add_new_item'  => 'Добавить регион',
				'new_item_name' => 'Название региона',
				'search_items'  => 'Искать регионы',
				'not_found'     => 'Регионы не найдены',
				'parent_item'   => 'Родительский регион',
			),
			'public'             => true,
			'publicly_queryable' => true,
			'hierarchical'       => true,
			'show_ui'            => true,
			'show_in_menu'       => true,
			'show_in_nav_menus'  => true,
			'show_tagcloud'      => true,
			'show_in_quick_edit' => true,
			// New: cmsms left this off, which 404'd `/wp/v2/pl-categs`.
			'show_in_rest'       => true,
			// The 72 terms are regions, so the admin list reads better with them.
			'show_admin_column'  => true,
			'rewrite'            => array(
				'slug'         => 'pl-categs',
				'with_front'   => true,
				'hierarchical' => false,
			),
		)
	);

	// The coordinator's region — «Магнитогорск», free text — filled on 130 of the
	// 139 published records. It is `cmsms_`-prefixed because cmsms created it, and
	// it keeps that name on purpose: renaming would mean rewriting 130 rows to buy
	// nothing. `fetchProfile` reads it as the card's second line when the body has
	// no bolded role, so losing it from REST would blank that line on 56 cards.
	// **Exclude this key from any `cmsms_%` postmeta purge.**
	register_post_meta(
		'profile',
		'cmsms_profile_subtitle',
		array(
			'type'         => 'string',
			'single'       => true,
			'show_in_rest' => true,
		)
	);
}
