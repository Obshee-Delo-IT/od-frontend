<?php
/**
 * Tests for `wp/mu-plugins/od-revalidate.php` — the routing table only, which is
 * the part that decides whether an edit reaches the frontend at all.
 *
 *     php wp/tests/od-revalidate.test.php
 *
 * WordPress is not loaded: `ABSPATH` and a `WP_Post` stub are enough for the file
 * to parse and for `boot()` to return early (it does nothing without its two
 * constants, which is the wanted state on an instance whose frontend is not
 * deployed). The private queue is read back through reflection, because what
 * matters is *what would be sent*, and `send()` needs a network.
 *
 * Why this file exists: a post type missing from `queue_post()` fails silently —
 * the editor saves, the purge never happens, and the page serves its cached
 * render for up to an hour. That is exactly what happened to `page` and
 * `profile` until 2026-08-18.
 *
 * @package od-frontend
 */

declare(strict_types=1);

require __DIR__ . '/harness.php';

define('ABSPATH', __DIR__);

/** The two fields `queue_post()` reads. */
class WP_Post
{
    public $ID;

    public $post_type;

    public function __construct(int $id, string $post_type)
    {
        $this->ID        = $id;
        $this->post_type = $post_type;
    }
}

/** `schedule()` reaches for it; the shutdown hook is not what this file checks. */
function add_action(string $hook, $callback, int $priority = 10, int $args = 1): bool
{
    return true;
}

require __DIR__ . '/../mu-plugins/od-revalidate.php';

/**
 * @return array{ids: array<int>, tags: array<string>}
 */
function od_revalidate_queue(WP_Post $post): array
{
    $class = new ReflectionClass('OD_Revalidate');

    foreach (['post_ids', 'tags', 'scheduled'] as $name) {
        $property = $class->getProperty($name);
        $property->setAccessible(true);
        $property->setValue(null, $name === 'scheduled' ? false : []);
    }

    $queue = $class->getMethod('queue_post');
    $queue->setAccessible(true);
    $queue->invoke(null, $post);

    $ids = $class->getProperty('post_ids');
    $ids->setAccessible(true);
    $tags = $class->getProperty('tags');
    $tags->setAccessible(true);

    return ['ids' => $ids->getValue(), 'tags' => $tags->getValue()];
}

od_test('no constants, no hooks — an instance with no frontend is left alone', OD_Revalidate::configured() === false);

// A post is purged by id: `wp:post:<id>` narrows it to the one detail page, and
// every film is a `post` with `format=video`.
$post = od_revalidate_queue(new WP_Post(39664, 'post'));
od_test('a post is queued by id', $post['ids'] === [39664]);
od_test('and carries no tag of its own', $post['tags'] === []);

// A page is purged by the coarse tag: WP pages render natively at their own URLs
// (D6b) and nothing lists them, so there is no per-page tag.
$page = od_revalidate_queue(new WP_Post(27642, 'page'));
od_test('a page is queued as wp:pages', $page['tags'] === ['wp:pages']);
od_test('and not by id, which the frontend does not tag pages with', $page['ids'] === []);

// A coordinator's record is drawn as a card inside a *page*, so its own id would
// purge nothing that shows it.
$profile = od_revalidate_queue(new WP_Post(46651, 'profile'));
od_test('a profile is queued as wp:profiles', $profile['tags'] === ['wp:profiles']);
od_test('and not by id', $profile['ids'] === []);

// Everything the frontend does not fetch: an attachment, the dead `project`
// drafts, WooCommerce leftovers, a revision's parent type.
foreach (['attachment', 'project', 'product', 'nav_menu_item'] as $type) {
    $other = od_revalidate_queue(new WP_Post(1, $type));
    od_test("{$type} is not queued at all", $other['ids'] === [] && $other['tags'] === []);
}

// The tags have to be the ones `src/shared/api/cacheTags.ts` puts on the fetches,
// and the endpoint only accepts tags in the `wp` namespace.
foreach (array_merge($page['tags'], $profile['tags']) as $tag) {
    od_test("{$tag} is in the wp namespace the endpoint validates", str_starts_with($tag, 'wp:'));
}

od_test_summary();
