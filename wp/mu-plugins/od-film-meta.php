<?php
/**
 * Plugin Name: OD — film meta for block bindings
 * Description: Exposes a film's card cover to the block editor's Block Bindings
 *              API, so a query loop can render it without a custom block.
 *
 * Install at `wp-content/mu-plugins/od-film-meta.php`. The canonical copy is
 * `wp/mu-plugins/od-film-meta.php` in the frontend repo — edit there, `scp` here.
 *
 * **PHP 7.0 syntax only.** Production's *site* PHP is 7.x while its CLI is 8.2,
 * and anything newer here is a parse error that takes the whole site down the
 * moment WordPress loads. No arrow functions, no typed properties, no `?string`.
 *
 * ---------------------------------------------------------------------------
 *
 * Why this exists. A film needs two covers: a 16∶9 still for `/video/`, which is
 * the featured image, and a portrait one for the programme pages, whose cards
 * are 3∶4. A post has exactly one featured image, and `core/post-featured-image`
 * knows only that one — so the portrait cover has to come from postmeta, and the
 * only way to read postmeta inside a query loop without writing a block is the
 * Block Bindings API (WordPress 6.5+; od-dev runs 6.8.8).
 *
 * Bindings read a *registered* meta key, and ACF's own fields are not registered
 * — `get_registered_meta_keys( 'post', 'post' )` lists one key on this site, and
 * it is core's `footnotes`. Hence the `register_meta()` below.
 *
 * The key is **`od_card_cover`, not `poster_image_url`**, even though the value
 * is normally the latter. Two reasons: `poster_image_url` means «the printable
 * плакат» to `FilmPosterCard` on the film page, and synthesising a value for it
 * would make every film claim to have one; and a card must not break when a film
 * has no плакат yet, so this key falls back to the featured image. Uploading a
 * плакат upgrades the card and nothing else has to happen.
 */

if (!defined('ABSPATH')) {
    exit;
}

const OD_CARD_COVER_KEY = 'od_card_cover';

add_action('init', 'od_film_meta_register');

/**
 * Register the key so `core/post-meta` bindings can see it. It is read-only from
 * the editor's point of view — nothing writes it, the value is computed below.
 */
function od_film_meta_register()
{
    register_meta('post', OD_CARD_COVER_KEY, array(
        'object_subtype' => 'post',
        'type' => 'string',
        'single' => true,
        'default' => '',
        'show_in_rest' => true,
        'description' => 'Portrait cover for a programme card: the printable плакат, else the featured image.',
        'auth_callback' => '__return_false',
    ));
}

add_filter('get_post_metadata', 'od_film_meta_card_cover', 10, 4);

/**
 * Compute `od_card_cover` on read. Nothing stores it, so a `get_post_meta()` for
 * this key would otherwise return an empty string.
 *
 * @param mixed  $value    Short-circuit value; null means «not handled».
 * @param int    $post_id  Post being read.
 * @param string $meta_key Key being read.
 * @param bool   $single   Whether a single value was asked for.
 * @return mixed
 */
function od_film_meta_card_cover($value, $post_id, $meta_key, $single)
{
    if ($meta_key !== OD_CARD_COVER_KEY) {
        return $value;
    }

    $poster = get_post_meta($post_id, 'poster_image_url', true);
    if (!is_string($poster) || trim($poster) === '') {
        $poster = (string) get_the_post_thumbnail_url($post_id, 'full');
    }

    // `get_post_metadata` wants the shape the caller asked for: a bare value for
    // `$single`, a list otherwise.
    return $single ? $poster : array($poster);
}
