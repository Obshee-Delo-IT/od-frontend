<?php
/**
 * Plugin Name: OD — frontend revalidation
 * Description: Tells the Next.js frontend what changed, so its ISR cache drops the affected pages instead of serving them until the hour rolls over.
 * Version:     1.0.0
 *
 * A **must-use** plugin: it lives in `wp-content/mu-plugins/`, so it survives
 * the headless theme swap and cannot be deactivated from the admin by accident.
 *
 * The canonical copy is `wp/mu-plugins/od-revalidate.php` in the od-frontend
 * repo — edit it there and re-upload, or the two drift. The endpoint it talks
 * to is that repo's `src/app/api/revalidate/route.ts`; the contract, the
 * install steps and what was measured are in `docs/wp-backend.md` §6.5.
 *
 * Configuration is two constants, set either in `wp-config.php` or in the
 * sibling `od-revalidate/config.php` (a subdirectory, so WordPress does not
 * autoload it as a second mu-plugin):
 *
 *   OD_REVALIDATE_URL     https://<frontend-host>/api/revalidate/  ← keep the
 *                         trailing slash; `trailingSlash: true` makes the bare
 *                         form a 308, and this client does not re-POST on one.
 *   OD_REVALIDATE_SECRET  the same value as the frontend's REVALIDATE_SECRET.
 *                         One per tier — stage must never hold prod's.
 *   OD_REVALIDATE_DEBUG   optional. Logs successful purges to debug.log as well
 *                         as failed ones. Off in production; failures are
 *                         logged either way.
 *
 * With either of the first two undefined the plugin does nothing at all, which
 * is the wanted state on an instance whose frontend isn't deployed yet.
 *
 * **The PHP here is deliberately old-fashioned** — no typed properties, no
 * `str_starts_with`, no `void` returns. One file has to run on both installs,
 * and prod is WordPress 5.5.5 on PHP 7.x (`mod_php7`), where 7.4+ syntax is a
 * parse error that would take the whole site down as soon as this file loads.
 *
 * @package od-frontend
 */

defined( 'ABSPATH' ) || exit;

if ( is_readable( __DIR__ . '/od-revalidate/config.php' ) ) {
	require_once __DIR__ . '/od-revalidate/config.php';
}

/**
 * Collects everything one WordPress request changed and posts it to the
 * frontend once, after the editor's own response has been sent.
 *
 * Batching is the whole reason this is a class and not two functions: a bulk
 * trash fires `trashed_post` twenty times in a single request, and trashing a
 * published post fires both that and `transition_post_status` for the same id.
 * Sending per hook would mean twenty HTTP requests where one will do, and would
 * purge the same tag repeatedly.
 *
 * **`blocking => false` is not what keeps the editor waiting-free**, contrary to
 * the obvious reading of the HTTP API. WordPress's curl transport still calls
 * `curl_exec()` for a non-blocking request and only throws the response away
 * (`class-wp-http-curl.php`, «We don't need to return the body»), so the caller
 * pays the full connect-and-timeout cost anyway: measured on od-dev, a save
 * against an unreachable frontend took **8.2 s against a 2.6 s baseline**.
 * What actually protects the editor is `fastcgi_finish_request()` — their
 * response is complete before the purge is attempted — plus a breaker that
 * stops trying for a few minutes once the frontend has failed, for the SAPIs
 * where that function does not exist.
 */
final class OD_Revalidate {

	/** Matches MAX_ITEMS in the route — larger batches are chunked, not dropped. */
	const MAX_ITEMS = 50;

	/** Seconds one purge attempt may take before it counts as a failure. */
	const TIMEOUT = 5;

	/** After a failure, stop trying for this long. */
	const BREAKER_SECONDS = 300;

	const BREAKER_KEY = 'od_revalidate_unreachable';

	/** @var int[] */
	private static $post_ids = array();

	/** @var string[] */
	private static $tags = array();

	/** @var bool */
	private static $scheduled = false;

	public static function boot() {
		if ( ! self::configured() ) {
			return;
		}

		// `transition_post_status`, which has existed since WP 2.3 and hands over
		// both the new and the old status — the two facts the draft rule below
		// needs. `wp_after_insert_post` would read better but arrived in 5.6, and
		// **prod is pinned to 5.5.5**, where it would silently never fire; this
		// hook also catches a scheduled post going live through cron, which
		// `wp_after_insert_post` misses. Firing before terms and meta are written
		// costs nothing here, because nothing is sent until `shutdown`.
		add_action( 'transition_post_status', array( __CLASS__, 'on_transition' ), 10, 3 );
		add_action( 'trashed_post', array( __CLASS__, 'on_gone' ), 10, 2 );
		add_action( 'untrashed_post', array( __CLASS__, 'on_gone' ), 10, 2 );
		add_action( 'deleted_post', array( __CLASS__, 'on_gone' ), 10, 2 );
		add_action( 'wp_update_nav_menu', array( __CLASS__, 'on_menu' ) );
		add_action( 'updated_option', array( __CLASS__, 'on_option' ) );
	}

	public static function configured() {
		return defined( 'OD_REVALIDATE_URL' ) && OD_REVALIDATE_URL
			&& defined( 'OD_REVALIDATE_SECRET' ) && OD_REVALIDATE_SECRET;
	}

	/**
	 * @param string  $new_status Status after the write.
	 * @param string  $old_status Status before it — `new` for an insert.
	 * @param WP_Post $post       Post.
	 */
	public static function on_transition( $new_status, $old_status, $post ) {
		if ( ! $post instanceof WP_Post || self::is_noise( $post->ID ) ) {
			return;
		}

		// Draft churn never reached the frontend, so purging on it would just
		// throw away a warm cache. A post that *was* published still counts:
		// that is how «снять с публикации» reaches the site.
		if ( 'publish' !== $new_status && 'publish' !== $old_status ) {
			return;
		}

		self::queue_post( $post );
	}

	/**
	 * Trash, restore, permanent delete.
	 *
	 * The second argument differs per hook and per WordPress version —
	 * `deleted_post` passes the WP_Post, the trash hooks pass the previous status
	 * as a string on 6.x and **nothing at all on 5.5.5** — hence the type check
	 * rather than a signature that trusts it. After a permanent delete
	 * `get_post()` can no longer answer, which is why the passed object wins.
	 *
	 * @param int                 $post_id Post id.
	 * @param WP_Post|string|null $context Post object on `deleted_post`, else the previous status.
	 */
	public static function on_gone( $post_id, $context = null ) {
		$post = $context instanceof WP_Post ? $context : get_post( $post_id );
		if ( ! $post instanceof WP_Post || self::is_noise( $post_id ) ) {
			return;
		}

		// Same rule as on_transition: a draft moving in and out of the bin was
		// never on the site, so purging for it would only cost a warm cache. Only
		// a 6.x trash hook says what the status used to be; on a permanent delete,
		// or anywhere on 5.5.5, there is no way to tell and purging is the safe
		// side of the guess.
		$previous_status = is_string( $context ) ? $context : null;
		if ( null !== $previous_status && 'publish' !== $previous_status && 'publish' !== $post->post_status ) {
			return;
		}

		self::queue_post( $post );
	}

	public static function on_menu() {
		self::queue_tag( 'wp:menus' );
	}

	/**
	 * Widgets have no edit hook of their own: `update_option_sidebars_widgets`
	 * fires on reorder, not on content change. The options themselves are the
	 * reliable signal.
	 *
	 * @param string $option Option name.
	 */
	public static function on_option( $option ) {
		if ( 'sidebars_widgets' === $option || 0 === strpos( (string) $option, 'widget_' ) ) {
			self::queue_tag( 'wp:widgets' );
		}
	}

	/**
	 * Fires one POST per chunk. Public so a purge can be triggered by hand:
	 *
	 *   wp --skip-plugins=clearfy-pro eval 'OD_Revalidate::send( array( "tags" => array( "wp" ) ) );'
	 *
	 * @param array $body Request body — postIds, tags or paths.
	 * @return bool Whether the purge landed.
	 */
	public static function send( array $body ) {
		if ( ! self::configured() ) {
			return false;
		}

		$payload  = wp_json_encode( $body );
		$response = wp_remote_post(
			OD_REVALIDATE_URL,
			array(
				// Not wp_safe_remote_post: that one refuses loopback and private
				// addresses, and a purge target on the same host is a legitimate
				// deployment. The URL is a constant, so there is no SSRF surface.
				'timeout'     => self::TIMEOUT,
				'redirection' => 0,
				// Blocking, deliberately: the response is the only way to know a
				// purge landed, and discarding it buys nothing (see above).
				'blocking'    => true,
				'headers'     => array(
					'content-type'        => 'application/json',
					'x-revalidate-secret' => OD_REVALIDATE_SECRET,
				),
				'body'        => $payload,
			)
		);

		$status = is_wp_error( $response )
			? 'WP_Error: ' . $response->get_error_message()
			: 'HTTP ' . wp_remote_retrieve_response_code( $response ) . ' ' . wp_remote_retrieve_body( $response );

		if ( is_wp_error( $response ) || wp_remote_retrieve_response_code( $response ) >= 400 ) {
			// A wrong secret and a dead host look the same from here, and both
			// want the same answer: stop asking for a while, and say so once.
			set_transient( self::BREAKER_KEY, time(), self::BREAKER_SECONDS );
			self::log( $payload . ' → ' . $status . ' — not retrying for ' . self::BREAKER_SECONDS . 's' );
			return false;
		}

		if ( defined( 'OD_REVALIDATE_DEBUG' ) && OD_REVALIDATE_DEBUG ) {
			self::log( $payload . ' → ' . $status . ' [' . PHP_SAPI . ']' );
		}

		return true;
	}

	/** Sends everything this request collected, deduplicated, in chunks. */
	public static function flush() {
		$post_ids = array_values( array_unique( self::$post_ids ) );
		$tags     = array_values( array_unique( self::$tags ) );

		self::$post_ids = array();
		self::$tags     = array();

		if ( ! $post_ids && ! $tags ) {
			return;
		}
		if ( get_transient( self::BREAKER_KEY ) ) {
			return;
		}

		// The editor is already looking at their saved post; the purge happens
		// on the frontend's time from here on. Only php-fpm can do this — under
		// any other SAPI the breaker above is the whole protection.
		if ( function_exists( 'fastcgi_finish_request' ) ) {
			fastcgi_finish_request();
		}

		$id_chunks  = array_chunk( $post_ids, self::MAX_ITEMS );
		$tag_chunks = array_chunk( $tags, self::MAX_ITEMS );

		$requests = max( count( $id_chunks ), count( $tag_chunks ) );
		for ( $i = 0; $i < $requests; $i++ ) {
			$body = array();
			if ( isset( $id_chunks[ $i ] ) ) {
				$body['postIds'] = $id_chunks[ $i ];
			}
			if ( isset( $tag_chunks[ $i ] ) ) {
				$body['tags'] = $tag_chunks[ $i ];
			}
			// One failed chunk means the next will fail the same way; a big bulk
			// edit against a dead frontend should cost one timeout, not ten.
			if ( ! self::send( $body ) ) {
				break;
			}
		}
	}

	/**
	 * Three post types reach the frontend, and each is addressed the way its
	 * fetches are tagged (`src/shared/api/cacheTags.ts`):
	 *
	 *   - `post` by id, because `wp:post:<id>` narrows the purge to one detail
	 *     page. Films are `post`s with `format=video`, so they come through here.
	 *   - `page` by the coarse `wp:pages` tag. WP pages render natively at their
	 *     own URLs since D6b, and there is no per-page tag to be worth the
	 *     vocabulary — a handful of pages, and nothing lists them.
	 *   - `profile` by `wp:profiles`. A coordinator's record is drawn as a card
	 *     inside a *page*, so an edit there has to purge the page that embeds it,
	 *     which the tag does and a post id would not.
	 *
	 * Anything else — `attachment`, the dead `project` drafts, WooCommerce
	 * leftovers — is not fetched by the frontend and is dropped here.
	 *
	 * @param WP_Post $post Post.
	 */
	private static function queue_post( WP_Post $post ) {
		if ( 'post' === $post->post_type ) {
			self::$post_ids[] = (int) $post->ID;
			self::schedule();

			return;
		}

		if ( 'page' === $post->post_type ) {
			self::queue_tag( 'wp:pages' );

			return;
		}

		if ( 'profile' === $post->post_type ) {
			self::queue_tag( 'wp:profiles' );
		}
	}

	private static function queue_tag( string $tag ) {
		self::$tags[] = $tag;
		self::schedule();
	}

	private static function schedule() {
		if ( self::$scheduled ) {
			return;
		}
		// Late, so anything else hooked into shutdown has finished writing.
		add_action( 'shutdown', array( __CLASS__, 'flush' ), 100 );
		self::$scheduled = true;
	}

	/**
	 * Revisions and autosaves are not content; an import would otherwise queue
	 * one purge per imported row.
	 *
	 * @param int $post_id Post id.
	 */
	private static function is_noise( $post_id ) {
		return ( defined( 'WP_IMPORTING' ) && WP_IMPORTING )
			|| (bool) wp_is_post_revision( $post_id )
			|| (bool) wp_is_post_autosave( $post_id );
	}

	private static function log( string $message ) {
		error_log( '[od-revalidate] ' . $message ); // phpcs:ignore WordPress.PHP.DevelopmentFunctions
	}
}

OD_Revalidate::boot();
