<?php
/*
Plugin Name: CMSMS-TO-Gutenberg-Upgrade
Description: Плагин для переноса блоков редактора CMS-Masters в редактор Gutenberg
Author: Воронков Николай
Version: 1.0.0
Author URI: https://voronkov.org
*/

//-- Подключение скриптов --
add_action('admin_enqueue_scripts', 'nv_gu_enqueue_assets');
function nv_gu_enqueue_assets($hook) {
    if (urldecode($hook) == 'toplevel_page_nv-menu') {
        wp_enqueue_script('jquery-ui-cdn', 'https://code.jquery.com/ui/1.14.1/jquery-ui.min.js', array('jquery'), '1.14.1', false);
        wp_enqueue_style('jquery-ui-style-cdn', 'https://code.jquery.com/ui/1.14.1/themes/base/jquery-ui.css', array(), '1.14.1');
    }
}

//--
add_action('admin_menu', 'nv_gu_admin_menu');
function nv_gu_admin_menu() {
    add_menu_page(
        '',
        'Upgrade editor',
        'manage_options',
        'nv-menu',
        'cmsms_gutenberg_admin_page',
        'dashicons-image-rotate-left',
        25
    );

    /*
    add_submenu_page(
        'nv-search-main-menu',
        'Сервисы',
        'Сервисы',
        'manage_options',
        'nv-search-services-sub-menu',
        'nv_search_services_submenu_page'
    );
    */

}

//--
function cmsms_gutenberg_admin_page() {
    include plugin_dir_path(__FILE__) . 'pages/cmsms-gutenberg-admin-page.php';
}

//--
function welfare_add_tags_to_profile() {
    register_taxonomy_for_object_type('post_tag', 'profile');

    register_post_meta('profile', 'cmsms_profile_subtitle', [
        'type'         => 'string',          // тип данных
        'single'       => true,              // одно значение на запись
        'show_in_rest' => true,              // чтобы Gutenberg увидел
        'auth_callback'=> function() {
            return current_user_can('edit_posts');
        },
    ]);
    
}
add_action('init', 'welfare_add_tags_to_profile');

//--
add_action('save_post', function ($post_ID, $post, $update) {
    if ($update) {
        delete_post_meta($post->ID, 'nvp_content_copy');
    }
}, 10, 3);

//--
add_action('wp_ajax_save_copy', 'save_copy');
function save_copy() {
    global $wpdb;
    $rez = [];
    if (!empty($_POST['id'])) {
        $id = $_POST['id'];
        $copy = get_post_meta($id, 'nvp_content_copy', true);
        if (!empty($copy)) {
            $post = get_post($id);
            if ($post) {
                wp_save_post_revision( $id );
                wp_update_post( [
                    'ID'           => $id,
                    'post_content' => welfare_to_gutenberg($post->post_content),
                ] );
                update_post_meta( $id, 'nvp_content_copy', $copy ); //-- при обновлении поста затирается через хук этот ключ
                update_post_meta( $id, 'cmsms_gutenberg_show', 'false' ); //-- без этого может не включиться для записи редактор gutenberg
                $rez['success'] = true;
            }
            else {
                $rez = [
                    'success' => false,
                    'error' => 'Запись не найдена'
                ];    
            }
        }
        else {
            $rez = [
                'success' => false,
                'error' => 'Ошибка! У записи нет копии.'
            ];    
        }
    } 
    else {
        $rez = [
            'success' => false,
            'error' => 'Ошибка! Не удалось определить ID записи'
        ];    
    }
    wp_send_json($rez);
}

//--
add_action('wp_ajax_restore_original_content', 'restore_original_content');
function restore_original_content() {
    global $wpdb;
    $rez = [];
    if (!empty($_POST['id'])) {
        $id = $_POST['id'];
        $copy = get_post_meta($id, 'nvp_content_copy', true);
        if (!empty($copy)) {
            $post = get_post($id);
            if ($post) {
                wp_save_post_revision( $id );
                wp_update_post( [
                    'ID'           => $id,
                    'post_content' => $copy,
                ] );
                update_post_meta( $id, 'nvp_content_copy', $copy ); //-- при обновлении поста затирается через хук этот ключ
                $rez['success'] = true;
            }
            else {
                $rez = [
                    'success' => false,
                    'error' => 'Запись не найдена'
                ];    
            }
        }
        else {
            $rez = [
                'success' => false,
                'error' => 'Ошибка! У записи нет копии, восстанавливать нечего.'
            ];    
        }
    } else {
        $rez = [
            'success' => false,
            'error' => 'Ошибка! Не удалось определить ID записи'
        ];    
    }
    wp_send_json($rez);
}

//--
add_action('wp_ajax_transform_gutenberg_cmsms', 'transform_gutenberg_cmsms');
function transform_gutenberg_cmsms() {
    global $wpdb;
    $sql = "
        UPDATE {$wpdb->posts} p
          JOIN {$wpdb->postmeta} pm ON p.ID = pm.post_id
           SET p.post_content = pm.meta_value
         WHERE pm.meta_key = 'nvp_content_copy'
    ";

    $rows_updated = $wpdb->query($sql);
    
    wp_cache_flush();
    
    $rez = [
        'success' => true,
        'result' => '<h3>Выполнено восстановление старых версий записей.</h3>Записей восстановлено: ' . $rows_updated
    ];    
    wp_send_json($rez);
}

//--
add_action('wp_ajax_transform_cmsms_gutenberg', 'transform_cmsms_gutenberg');
function transform_cmsms_gutenberg() {
    global $wpdb;

    $results = $wpdb->get_results(
        $wpdb->prepare(
            "SELECT pm.post_id, 
                    pm.meta_value 
               FROM wp_postmeta pm, wp_posts po
              WHERE pm.meta_key = 'nvp_content_copy'
                AND po.ID = pm.post_id
                AND po.post_status = 'publish'
                AND po.post_type IN ('post', 'page', 'profile')"
        )
    );

    $updated_count = 0;

    foreach ($results as $row) {
        $post_id   = intval($row->post_id);
        $old_value = $row->meta_value;

        $new_content = welfare_to_gutenberg($old_value);

        $res = $wpdb->update(
            $wpdb->posts,
            ['post_content' => $new_content],
            ['ID' => $post_id],
            ['%s'],
            ['%d']
        );
        
        update_post_meta( $post_id, 'cmsms_gutenberg_show', 'false' );

        if ($res !== false) {
            $updated_count += $res;
            clean_post_cache($post_id);
        }
    }

    $rez = [
        'success' => true,
        'result' => '<h3>Выполнено преобразование контента записей.</h3>Записей обновлено: ' . $updated_count
    ];    
    wp_send_json($rez);
}


//--
add_action('wp_ajax_copy_records_content', 'copy_records_content');
function copy_records_content() {
    global $wpdb;

    $sql = "
    INSERT INTO {$wpdb->postmeta} (
        post_id,
        meta_key,
        meta_value
    )
    SELECT po.ID,
           'nvp_content_copy',
           po.post_content 
      FROM {$wpdb->posts} po
     WHERE NOT EXISTS (
       SELECT 1 FROM {$wpdb->postmeta} pm 
        WHERE pm.post_id = po.ID 
          AND pm.meta_key = 'nvp_content_copy'
     )
       AND po.post_status = 'publish'
       AND po.post_type IN ('post', 'page', 'profile')
    ";
    $inserted = $wpdb->query($sql);
    
    $sql = "
        SELECT COUNT(*) 
          FROM {$wpdb->postmeta} pm 
         WHERE pm.meta_key = 'nvp_content_copy'
    ";
    $count = $wpdb->get_var($sql);

    $rez = [
        'success' => true,
        'result' => '<h3>Выполнено копирование контента записей.</h3>Записей скопировано: ' . $inserted . '<br/>Всего записей: ' . $count
    ];    
    wp_send_json($rez);
}

//--
add_action('wp_ajax_get_cmsms_gutenberg', 'get_cmsms_gutenberg');
function get_cmsms_gutenberg() {
    global $wpdb;
    
    $tree = [];
    if (!empty($_POST['id'])) {
        $id = $_POST['id'];
        $post = get_post($id);
        if ($post) {
            $original = apply_filters('the_content', $post->post_content);
            $tree = [
                'original'  => $original,
                'id'        => $id,
                'title'     => $post->post_title,
                'url'       => get_permalink($id)
            ];    
            $tree['code'] = $post->post_content;

            $upgradeCode = welfare_to_gutenberg($post->post_content);
            
            $upgrade = apply_filters('the_content', $upgradeCode);
            
            $tree['upgrade'] = $upgrade;
            $tree['upgradeCode'] = $upgradeCode;
            
            $copy = get_post_meta($id, 'nvp_content_copy', true);
            $tree['hasCopy'] = !empty($copy);
            
            $tree['success'] = true;
        }
        else {
            $tree = [
                'success' => false,
                'error' => 'Запись не найдена'
            ];    
        }
    } else {
        $tree = [
            'success' => false,
            'error' => 'Не удалось определить ID записи'
        ];    
    }
    
    wp_send_json($tree);
}

//--
function welfare_to_gutenberg($content) {
    wp_cache_flush();
    $queryNumber = 0;
    //-- cmsms_row → group + columns
    $content = preg_replace(
        '/\[cmsms_row[^\]]*\]/',
        '<!-- wp:group {"layout":{"type":"constrained"}} --><div class="wp-block-group"><!-- wp:columns --><div class="wp-block-columns">',
        $content
    );
    $content = str_replace('[/cmsms_row]', '</div><!-- /wp:columns --></div><!-- /wp:group -->', $content);

    //-- cmsms_column → column с шириной --
    $content = preg_replace_callback('/\[cmsms_column([^\]]*)\]/', function ($m) {
        $atts_str = $m[1];
        $atts = [];

        // достаем все атрибуты
        if (preg_match_all('/(\w+)="([^"]*)"/', $atts_str, $matches, PREG_SET_ORDER)) {
            foreach ($matches as $a) {
                $atts[$a[1]] = $a[2];
            }
        }

        $width = '';
        if (!empty($atts['data_width']) && strpos($atts['data_width'], '/') !== false) {
            list($num, $den) = explode('/', $atts['data_width']);
            if ($den > 0) {
                $width = round($num / $den * 100, 2) . '%';
            }
        }

        $className = !empty($atts['data_classes']) ? trim($atts['data_classes']) : '';

        $json = [];
        if ($width) {
            $json['width'] = $width;
        }
        if ($className) {
            $json['className'] = $className;
        }

        return sprintf(
            '<!-- wp:column%s --><div class="wp-block-column%s"%s>',
            $json ? ' ' . wp_json_encode($json, JSON_UNESCAPED_UNICODE) : '',
            $className ? ' ' . esc_attr($className) : '',
            $width ? ' style="flex-basis:' . esc_attr($width) . '"' : ''
        );
    }, $content);
    $content = str_replace('[/cmsms_column]', '</div><!-- /wp:column -->', $content);

    //-- Текстовый блок --
    $content = preg_replace_callback('/\[cmsms_text[^\]]*\](.*?)\[\/cmsms_text\]/s', function($m) {
        $text = trim($m[1]);
        // Эмуляция поведения оригинального шорткода: wpautop + безопасный HTML
        $text = wpautop($text);
        $text = wp_kses_post($text);
        return '<!-- wp:paragraph -->' . $text . '<!-- /wp:paragraph -->';
    }, $content);

    //-- Кнопка --
    $content = preg_replace_callback(
        '/\[cmsms_button([^\]]*)\](.*?)\[\/cmsms_button\]/u',
        function ($m) {
            $atts_str = $m[1];
            $label    = trim($m[2]);

            // Разбираем атрибуты
            $atts = [];
            if (preg_match_all('/(\w+)="([^"]*)"/u', $atts_str, $matches, PREG_SET_ORDER)) {
                foreach ($matches as $a) {
                    $atts[$a[1]] = $a[2];
                }
            }

            $url    = isset($atts['button_link']) ? esc_url($atts['button_link']) : '#';
            $target = (isset($atts['button_target']) && strtolower($atts['button_target']) === 'blank') ? ' target="_blank" rel="noopener"' : '';

            // Выравнивание
            $align_class = (!empty($atts['button_text_align'])) ? ' has-text-align-' . esc_attr(strtolower($atts['button_text_align'])) : '';

            return '<!-- wp:button -->'
                . '<div class="wp-block-button' . $align_class . '">'
                . '<a class="wp-block-button__link wp-element-button" href="' . $url . '"' . $target . '>' . $label . '</a>'
                . '</div>'
                . '<!-- /wp:button -->';
        },
        $content
    );

    //-- Разделитель
    $content = preg_replace('/\[cmsms_divider[^\]]*\]/', '<!-- wp:separator --><hr class="wp-block-separator"/><!-- /wp:separator -->', $content);

    //--  Галерея --
    $content = preg_replace_callback('/\[cmsms_gallery([^\]]*)\](.*?)\[\/cmsms_gallery\]/s', function ($m) {
    $atts_str   = $m[1];
    $images_str = trim($m[2]);

    preg_match_all('/(\w+)="([^"]*)"/', $atts_str, $attr_matches, PREG_SET_ORDER);
    $atts = [];
    foreach ($attr_matches as $a) {
        $atts[$a[1]] = $a[2];
    }

    $columns = isset($atts['gallery_columns']) ? max(1, intval($atts['gallery_columns'])) : 3;
    $linkTo  = (isset($atts['gallery_links']) && ($atts['gallery_links'] === 'lightbox' || $atts['gallery_links'] === 'media')) ? 'media' : 'none';
    $size    = isset($atts['image_size_gallery']) ? $atts['image_size_gallery'] : 'large';

    $items = array_map('trim', array_filter(explode(',', $images_str)));
    ob_start(); ?>
<!-- wp:gallery {"columns":<?php echo $columns; ?>,"linkTo":"<?php echo esc_attr($linkTo); ?>","sizeSlug":"<?php echo esc_attr($size); ?>","className":"is-layout-flex cmsms-gallery-fixed"} -->
<figure class="wp-block-gallery is-layout-flex cmsms-gallery-fixed has-nested-images is-cropped columns-<?php echo $columns; ?>">
<?php foreach ($items as $item):
    if (strpos($item, '|') !== false) {
        list($id, $url) = explode('|', $item, 2);
        $id = intval($id);
        $url = wp_get_attachment_url($id);
    } else {
        $id = 0; 
        $url = $item;
    } ?>
    <!-- wp:image {"id":<?php echo $id; ?>,"sizeSlug":"<?php echo esc_attr($size); ?>","linkDestination":"<?php echo esc_attr($linkTo); ?>"} -->
    <figure class="wp-block-image size-<?php echo esc_attr($size); ?>">
        <?php if ($linkTo === 'media'): ?>
        <a href="<?php echo esc_url($url); ?>"><img src="<?php echo esc_url($url); ?>" alt=""/></a>
        <?php else: ?>
            <img src="<?php echo esc_url($url); ?>" alt=""/>
        <?php endif; ?>
    </figure>
    <!-- /wp:image -->
<?php endforeach; ?>
</figure>
<!-- /wp:gallery -->

<!-- wp:html -->
<style>
.wp-block-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}    
.wp-block-gallery.cmsms-gallery-fixed.is-layout-flex {
  justify-content: flex-start;
}
.wp-block-gallery.cmsms-gallery-fixed.is-layout-flex .wp-block-image {
  flex-grow: 0 !important;
}
:root {
  --cmsms-gallery-gap: var(--wp--style--gallery-gap, var(--wp--style--block-gap, .5em));
}
.wp-block-gallery.cmsms-gallery-fixed.is-layout-flex.columns-<?php echo $columns; ?> .wp-block-image {
  flex-basis: calc((100% - (<?php echo $columns; ?> - 1) * var(--cmsms-gallery-gap)) / <?php echo $columns; ?>);
  max-width:  calc((100% - (<?php echo $columns; ?> - 1) * var(--cmsms-gallery-gap)) / <?php echo $columns; ?>);
}
</style>
<!-- /wp:html -->
    <?php
        return ob_get_clean();
    }, $content);

    //-- cmsms_image --
    //-- Атрибуты шорткода читаются, а не отбрасываются: link="" задаёт адрес
    //-- плитки, classes="" — её оформление. Раньше и то и другое терялось,
    //-- поэтому плитки разделов вели на файл картинки вместо дочерней страницы,
    //-- а .image из [cmsms_css] той же записи было не к чему применить.
    $content = preg_replace_callback('/\[cmsms_image([^\]]*)\](.*?)\[\/cmsms_image\]/s', function ($m) {
        $atts = [];
        preg_match_all('/(\w+)="([^"]*)"/', $m[1], $attr_matches, PREG_SET_ORDER);
        foreach ($attr_matches as $a) {
            $atts[$a[1]] = $a[2];
        }

        $parts = explode('|', trim($m[2]));
        $id = intval($parts[0] ?? 0);
        $url = $parts[1] ?? '';
        $size = $parts[2] ?? 'large';
        if (!$url) return '';

        $link = isset($atts['link']) ? trim($atts['link']) : '';
        //-- Часть ссылок на файлы записана без ведущего слеша ("wp-content/…").
        //-- Относительный href разрешался бы от адреса записи, то есть в никуда,
        //-- поэтому приводим к корневому пути.
        if (preg_match('#^wp-content/#', $link)) {
            $link = '/' . $link;
        }
        $href = $link !== '' ? $link : $url;
        //-- Без link="" поведение прежнее: ссылка на сам файл, лайтбокс.
        //-- Ссылка на этот же файл — тоже media, а не custom: так её видит редактор.
        $destination = ($link !== '' && $link !== $url) ? 'custom' : 'media';

        $classes = isset($atts['classes']) ? trim(preg_replace('/\s+/', ' ', $atts['classes'])) : '';

        $block_atts = ['id' => $id, 'sizeSlug' => $size, 'linkDestination' => $destination];
        if ($classes !== '') {
            $block_atts['className'] = $classes;
        }

        return '<!-- wp:image ' . wp_json_encode($block_atts, JSON_UNESCAPED_UNICODE) . ' -->
<figure class="wp-block-image size-' . esc_attr($size) . ($classes ? ' ' . esc_attr($classes) : '') . '"><a href="' . esc_url($href) . '"><img src="' . esc_url($url) . '" alt=""/></a></figure>
<!-- /wp:image -->';
    }, $content);
    
    //-- cmsms_heading --
    $content = preg_replace_callback(
        '/\[cmsms_heading([^\]]*)](.*?)\[\/cmsms_heading\]/s',
        function ($m) {
            $atts_str = $m[1];  // строка атрибутов
            $inner    = trim($m[2]);

            $atts = [];
            preg_match_all('/(\w+)="([^"]*)"/', $atts_str, $attr_matches, PREG_SET_ORDER);
            foreach ($attr_matches as $a) {
                $atts[$a[1]] = $a[2];
            }

            $tag = isset($atts['type']) ? strtolower($atts['type']) : 'h2';
            if (!preg_match('/^h[1-6]$/', $tag)) {
                $tag = 'h2'; // fallback
            }
            $level = intval(substr($tag, 1));

            $gb_atts = [
                'level' => $level,
            ];

            if (!empty($atts['text_align'])) {
                $gb_atts['textAlign'] = $atts['text_align'];
            }

            $style = [];
            if (isset($atts['margin_top'])) {
                $style['spacing']['margin']['top'] = $atts['margin_top'] . 'px';
            }
            if (isset($atts['margin_bottom'])) {
                $style['spacing']['margin']['bottom'] = $atts['margin_bottom'] . 'px';
            }
            if (!empty($style)) {
                $gb_atts['style'] = $style;
            }

            $json = !empty($gb_atts) ? ' ' . wp_json_encode($gb_atts) : '';

            return sprintf(
                '<!-- wp:heading%s --><%s class="wp-block-heading%s">%s</%s><!-- /wp:heading -->',
                $json,
                $tag,
                (!empty($atts['text_align']) ? ' has-text-align-' . esc_attr($atts['text_align']) : ''),
                esc_html($inner),
                $tag
            );
        },
        $content
    );

    //-- cmsms_blog --
    $content = preg_replace_callback('/\[cmsms_blog([^\]]*)\]/', function ($m) {
        global $queryNumber;
        $atts_str = $m[1];
        preg_match_all('/(\w+)="([^"]*)"/', $atts_str, $attr_matches, PREG_SET_ORDER);
        $atts = [];
        foreach ($attr_matches as $a) {
            $atts[$a[1]] = $a[2];
        }

        $count   = isset($atts['count']) ? intval($atts['count']) : 10;
        $orderby = $atts['orderby'] ?? 'date';
        $order   = $atts['order'] ?? 'DESC';
        $columns = isset($atts['columns']) ? intval($atts['columns']) : 1;
        $catslug = $atts['categories'] ?? '';

        $query = [
            "perPage" => $count,
            "pages" => 0,
            "offset" => 0,
            "postType" => "post",
            "order" => strtolower($order),
            "orderBy" => $orderby,
            "inherit" => false,
        ];

        if ($catslug) {
            $term = get_category_by_slug($catslug);
            if ($term) {
                $query["taxQuery"] = ["category" => [$term->term_id]];
            }
        }

        $queryNumber++;
        $attrs = [
            "queryId"       => $queryNumber,
            "query"         => $query
        ];
        $json = wp_json_encode($attrs);
        

        return '<!-- wp:query ' . $json . ' -->
<div class="wp-block-query">
    <!-- wp:post-template {"layout":{"type":"grid","columnCount": ' . $columns . '}} -->  
    <!-- wp:post-featured-image {"isLink":true} /-->
    <!-- wp:post-title {"isLink":true} /-->
    <!-- wp:post-date /-->
    <!-- wp:post-excerpt /-->
  <!-- /wp:post-template -->

  <!-- wp:query-pagination -->
    <!-- wp:query-pagination-previous /-->
    <!-- wp:query-pagination-numbers /-->
    <!-- wp:query-pagination-next /-->
  <!-- /wp:query-pagination -->
</div>
<!-- /wp:query -->';
    }, $content);

    // cmsms_toggles / cmsms_toggle
    $content = preg_replace('/\[cmsms_toggles[^\]]*\]/', '', $content);
    $content = str_replace('[/cmsms_toggles]', '', $content);
    $content = preg_replace_callback('/\[cmsms_toggle[^\]]*title="([^"]+)"[^\]]*\](.*?)\[\/cmsms_toggle\]/s', function ($m) {
        $title = esc_html($m[1]);
        $body  = trim($m[2]);
        $body = wpautop($body);
        return '<!-- wp:details -->
<details class="wp-block-details">
  <summary>' . $title . '</summary>
  <!-- wp:paragraph -->
  ' . $body . '
  <!-- /wp:paragraph -->
</details>
<!-- /wp:details -->';
    }, $content);
    
    // cmsms_embed → wp:embed, любой вариант шорткода
    $content = preg_replace_callback('/\[cmsms_embed([^\]]*)\](?:.*?\[\/cmsms_embed\])?/s', function ($m) {
        $atts_str = $m[1];
        $atts = [];
        preg_match_all('/(\w+)="([^"]*)"/', $atts_str, $attr_matches, PREG_SET_ORDER);
        foreach ($attr_matches as $a) {
            $atts[$a[1]] = $a[2];
        }

        // Берём ссылку (может быть атрибут link или url)
        $url = '';
        if (isset($atts['link'])) $url = esc_url($atts['link']);
        elseif (isset($atts['url'])) $url = esc_url($atts['url']);

        $width  = isset($atts['width']) ? intval($atts['width']) : null;
        $height = isset($atts['height']) ? intval($atts['height']) : null;

        $json_attrs = [];
        if ($width)  $json_attrs['width'] = $width;
        if ($height) $json_attrs['height'] = $height;
        $json_attrs['url'] = $url;

        return '<!-- wp:embed ' . wp_json_encode($json_attrs) . ' -->' . "\n" . $url . "\n<!-- /wp:embed -->";
    }, $content);
    
    // cmsms_html → wp:html с декодированием base64
    $content = preg_replace_callback('/\[cmsms_html[^\]]*\](.*?)\[\/cmsms_html\]/s', function ($m) {
        $inner = trim($m[1]);

        // Декодируем base64
        $decoded = base64_decode($inner);

        // Оборачиваем в wp:html
        return "<!-- wp:html -->\n" . $decoded . "\n<!-- /wp:html -->";
    }, $content);

    //-- cmsms_css → wp:html с декодированием base64 --
    $content = preg_replace_callback('/\[cmsms_css([^\]]*)\](.*?)\[\/cmsms_css\]/s', function ($m) {
        $atts_str = $m[1];
        $inner    = trim($m[2]);

        // Разбираем атрибуты
        $classes = '';
        if ($atts_str) {
            preg_match_all('/(\w+)="([^"]*)"/', $atts_str, $attr_matches, PREG_SET_ORDER);
            foreach ($attr_matches as $a) {
                if ($a[1] === 'classes') $classes = $a[2];
            }
        }

        // Декодируем CSS
        $css = base64_decode($inner);

        /*
        $html = '<div class="custom_css' . ($classes ? ' ' . esc_attr($classes) : '') . '">' . "\n" .
                '<style type="text/css">' . "\n" . $css . "\n</style>" . "\n" .
                '</div>';
        */

        $html = '<style type="text/css">' . "\n" . $css . "\n</style>" . "\n";

        
        return "<!-- wp:html -->\n" . $html . "\n<!-- /wp:html -->";
    }, $content);
    
    //-- cmsms_js → wp:html с декодированием base64 --
    $content = preg_replace_callback('/\[cmsms_js([^\]]*)\](.*?)\[\/cmsms_js\]/s', function ($m) {
        $atts_str = $m[1];
        $inner    = trim($m[2]);

        // Разбираем атрибуты
        $classes = '';
        if ($atts_str) {
            preg_match_all('/(\w+)="([^"]*)"/', $atts_str, $attr_matches, PREG_SET_ORDER);
            foreach ($attr_matches as $a) {
                if ($a[1] === 'classes') $classes = $a[2];
            }
        }

        // Декодируем JS
        $js = base64_decode($inner);

        // Формируем HTML блок
        $html = '<div class="custom_js' . ($classes ? ' ' . esc_attr($classes) : '') . '">' . "\n" .
                '<script type="text/javascript">' . "\n" . $js . "\n</script>" . "\n" .
                '</div>';

        return "<!-- wp:html -->\n" . $html . "\n<!-- /wp:html -->";
    }, $content);

    //-- cmsms_icon_box → Gutenberg блок --
    $content = preg_replace_callback('/\[cmsms_icon_box([^\]]*)\](.*?)\[\/cmsms_icon_box\]/s', function ($m) {
        $atts_str = $m[1];
        $inner    = trim($m[2]);

        $atts = [];
        preg_match_all('/(\w+)="([^"]*)"/', $atts_str, $attr_matches, PREG_SET_ORDER);
        foreach ($attr_matches as $a) $atts[$a[1]] = $a[2];

        // Основные атрибуты
        $heading = $atts['heading_type'] ?? 'h3';
        $icon = $atts['box_icon'] ?? '';
        $icon_size = intval($atts['box_icon_size'] ?? 40);
        $box_bg_color = $atts['box_bg_color'] ?? '#ffffff';
        $box_color = $atts['box_color'] ?? '#000000';
        $box_border_radius = $atts['box_border_radius'] ?? '0px';
        $box_border_width = $atts['box_border_width'] ?? '0';

        $button_show = isset($atts['button_show']) && $atts['button_show']==='true';
        $button_title = $atts['button_title'] ?? '';
        $button_link  = $atts['button_link'] ?? '';
        $button_target = ($atts['button_target'] ?? '')==='self' ? '_self' : '_blank';

        $classes = $atts['classes'] ?? '';

        $style = "background-color:{$box_bg_color};color:{$box_color};border-radius:{$box_border_radius};border-width:{$box_border_width}px;";

        ob_start();
        ?>
    <!-- wp:group {"className":"cmsms-icon-box<?php echo $classes ? ' '.esc_attr($classes) : ''; ?>","style":{"spacing":{},"color":{},"border":{}}} -->
    <div class="wp-block-group cmsms-icon-box<?php echo $classes ? ' '.esc_attr($classes) : ''; ?>" style="<?php echo esc_attr($style); ?>">
        <?php if ($icon): ?>
        <!-- wp:html -->
        <span class="<?php echo esc_attr($icon); ?>" style="font-size:<?php echo esc_attr($icon_size); ?>px;"></span>
        <!-- /wp:html -->
        <?php endif; ?>

        <!-- wp:heading {"level":<?php echo esc_attr(substr($heading,1)); ?>} -->
        <<?php echo esc_html($heading); ?>><?php echo strip_tags($inner); ?></<?php echo esc_html($heading); ?>>
        <!-- /wp:heading -->

        <?php if ($button_show && $button_title && $button_link): ?>
        <!-- wp:button -->
        <div class="wp-block-button"><a class="wp-block-button__link" href="<?php echo esc_url($button_link); ?>" target="<?php echo esc_attr($button_target); ?>"><?php echo esc_html($button_title); ?></a></div>
        <!-- /wp:button -->
        <?php endif; ?>
    </div>
    <!-- /wp:group -->
        <?php
        return ob_get_clean();
    }, $content);

    //-- cmsms_videos / cmsms_video → wp:video --
    $content = preg_replace_callback('/\[cmsms_videos[^\]]*\](.*?)\[\/cmsms_videos\]/s', function ($m) {
        $inner = $m[1];

        // Ищем все cmsms_video
        preg_match_all('/\[cmsms_video\](.*?)\[\/cmsms_video\]/s', $inner, $video_matches, PREG_SET_ORDER);

        $out = '';
        foreach ($video_matches as $vm) {
            $src = trim($vm[1]);
            if (!$src) continue;

            // Определяем MIME по расширению
            $ext = strtolower(pathinfo($src, PATHINFO_EXTENSION));
            $mime = '';
            if ($ext === 'mp4') $mime = 'video/mp4';
            elseif ($ext === 'webm') $mime = 'video/webm';
            elseif ($ext === 'ogv' || $ext === 'ogg') $mime = 'video/ogg';

            $out .= '<!-- wp:video -->
<figure class="wp-block-video"><video controls preload="metadata">' .
    '<source src="' . esc_url($src) . '"' . ($mime ? ' type="' . esc_attr($mime) . '"' : '') . ' />' .
    '</video></figure>
<!-- /wp:video -->';
        }

        return $out;
    }, $content);

    //-- Профили (cmsms_profiles → wp:query c postType=profile) --
    $content = preg_replace_callback('/\[cmsms_profiles([^\]]*)\]/', function ($m) {
        global $queryNumber;
        $atts_str = $m[1];
        $atts = [];
        preg_match_all('/(\w+)="([^"]*)"/', $atts_str, $attr_matches, PREG_SET_ORDER);
        foreach ($attr_matches as $a) {
            $atts[$a[1]] = $a[2];
        }

        $count   = isset($atts['count']) ? intval($atts['count']) : 12;
        $orderby = isset($atts['orderby']) ? strtolower($atts['orderby']) : 'date';
        $order   = isset($atts['order']) ? strtoupper($atts['order']) : 'DESC';
        $columns = isset($atts['columns']) ? intval($atts['columns']) : 1;
        $tags    = isset($atts['categories']) ? $atts['categories'] : '';

        $taxQuery = [];

        if (!empty($tags)) {
            $slugs = array_map('trim', explode(',', $tags));

            foreach ($slugs as $slug) {
                $term = get_term_by('slug', $slug, 'post_tag');
                if ($term) {
                    $taxQuery['post_tag'][] = intval($term->term_id);
                }
            }
        }

        $query = [
            "perPage" => $count,
            "pages"   => 0,
            "offset"  => 0,
            "postType"=> "profile",
            "order"   => strtolower($order),
            "orderBy" => esc_attr($orderby),
            "inherit" => false
        ];

        if (empty($taxQuery)) {
            $taxQuery['post_tag'][] = -1;
        }
        $query["taxQuery"] = $taxQuery;

        $queryNumber++;
        $attrs = [
            "queryId"       => $queryNumber,
            "query"         => $query
        ];
        $json = wp_json_encode($attrs);

        ob_start();
        ?>
    <!-- wp:query <?php echo $json; ?> -->
    <div class="wp-block-query">
        <!-- wp:post-template {"layout":{"type":"grid","columnCount":<?php echo $columns; ?>}} -->
            <!-- wp:group {"layout":{"type":"constrained"}} -->
            <div class="wp-block-group">
                <!-- wp:post-featured-image {"isLink":true, "className":"profile-thumbnail"} /-->
                <!-- wp:post-title {"isLink":true,"level":3} /-->
            </div>
            <!-- /wp:group -->
        <!-- /wp:post-template -->

        <!-- wp:query-pagination {"layout":{"type":"flex","justifyContent":"center"}} -->
            <!-- wp:query-pagination-previous /-->
            <!-- wp:query-pagination-numbers /-->
            <!-- wp:query-pagination-next /-->
        <!-- /wp:query-pagination -->
    </div>
    <!-- /wp:query -->
        <?php
        return ob_get_clean();
    }, $content);
    
    return $content;
}

//--
add_action('wp_ajax_get_tree_old_editor', 'get_tree_old_editor');
function get_tree_old_editor() {
    global $wpdb;
    $posts = $wpdb->get_results("
        SELECT ID, post_content 
        FROM {$wpdb->posts} 
        WHERE post_type IN ('page', 'post', 'profile') 
          AND post_status = 'publish'
    ");

    $aggTree = [];
    foreach ($posts as $p) {
        $tree = parse_shortcodes($p->post_content);
        merge_trees($aggTree, $tree);
    }

    $rez = "=== Агрегированное дерево шорткодов ===<br/>" . print_tree($aggTree, '--');
    
    $tree = [
        'success' => true,
        'result' => $rez
    ];    
    wp_send_json($tree);
}

//-- Разбор шорткодов в дерево
function parse_shortcodes($content) {
    $pattern = get_shortcode_regex();
    $result = [];

    if (preg_match_all('/' . $pattern . '/s', $content, $matches, PREG_SET_ORDER)) {
        foreach ($matches as $shortcode) {
            if (strpos($shortcode[2], 'cmsms_') === 0 && !empty(trim($shortcode[5]))) {
                $result[] = $shortcode;
                $tag   = $shortcode[2];
                $attrs = shortcode_parse_atts($shortcode[3]);
                $inner = $shortcode[5];

                $node = [
                    'tag'   => $tag,
                    'attrs' => $attrs ?: [],
                    'children' => parse_shortcodes($inner),
                ];
                $result[] = $node;
            }
        }
    }

    return $result;
}

//-- Слияние дерева одного поста в агрегированное дерево
function merge_trees(&$agg, $nodes) {
    foreach ($nodes as $n) {
        $tag = $n['tag'];
        if (!isset($agg[$tag])) {
            $agg[$tag] = [
                'count' => 0,
                'children' => [],
            ];
        }
        $agg[$tag]['count']++;
        merge_trees($agg[$tag]['children'], $n['children']);
    }
}

//-- Вывод дерева
function print_tree($agg, $prefix = '') {
    $rez = '';
    foreach ($agg as $tag => $info) {
        if ($tag === '') {
            continue;
        }
        $rez .= $prefix . "<button class=btn onclick=\"getShortcodeRecords('$tag');\">$tag</button> (встречается: {$info['count']})<br/>";
        if (!empty($info['children'])) {
            $rez .= print_tree($info['children'], $prefix . "*--");
        }
    }
    return $rez;
}

//-- Записи, участвующие в миграции: те, у кого есть резервная копия оригинала.
function nv_gu_migratable_ids($ids = []) {
    global $wpdb;

    $sql = "SELECT pm.post_id
              FROM {$wpdb->postmeta} pm
              JOIN {$wpdb->posts} po ON po.ID = pm.post_id
             WHERE pm.meta_key = 'nvp_content_copy'
               AND po.post_status = 'publish'
               AND po.post_type IN ('post', 'page', 'profile')";

    if ($ids) {
        $sql .= ' AND po.ID IN (' . implode(',', array_map('intval', $ids)) . ')';
    }

    return array_map('intval', $wpdb->get_col($sql . ' ORDER BY po.ID'));
}

//-- WP-CLI: те же четыре операции, что и в админке, но вызываемые из скрипта.
//-- На этой установке clearfy-pro редиректит на https в init, поэтому каждой
//-- команде нужен --url=https://<хост>, иначе WP-CLI падает ещё до загрузки.
if (defined('WP_CLI') && WP_CLI) {
    class NV_GU_CLI_Command {

        /**
         * Сохраняет оригинал post_content в мету nvp_content_copy там, где копии ещё нет.
         * Выполняется один раз перед первой миграцией и безопасен при повторном запуске.
         *
         * ## EXAMPLES
         *
         *     wp cmsms backup --url=https://od-dev.tmweb.ru
         */
        public function backup() {
            global $wpdb;

            $inserted = $wpdb->query("
                INSERT INTO {$wpdb->postmeta} (post_id, meta_key, meta_value)
                SELECT po.ID, 'nvp_content_copy', po.post_content
                  FROM {$wpdb->posts} po
                 WHERE NOT EXISTS (
                    SELECT 1 FROM {$wpdb->postmeta} pm
                     WHERE pm.post_id = po.ID AND pm.meta_key = 'nvp_content_copy'
                 )
                   AND po.post_status = 'publish'
                   AND po.post_type IN ('post', 'page', 'profile')
            ");

            $total = $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->postmeta} WHERE meta_key = 'nvp_content_copy'");
            WP_CLI::success("Скопировано записей: {$inserted}. Всего копий: {$total}.");
        }

        /**
         * Преобразует оригинал из копии в блоки Gutenberg и записывает в post_content.
         *
         * ## OPTIONS
         *
         * [--post=<ids>]
         * : Список ID через запятую. По умолчанию — все записи с копией.
         *
         * [--dry-run]
         * : Ничего не писать, только показать, что изменится.
         *
         * ## EXAMPLES
         *
         *     wp cmsms migrate --post=57271 --dry-run --url=https://od-dev.tmweb.ru
         *     wp cmsms migrate --url=https://od-dev.tmweb.ru
         */
        public function migrate($args, $assoc_args) {
            $dry = !empty($assoc_args['dry-run']);
            $ids = nv_gu_migratable_ids($this->requested_ids($assoc_args));
            if (!$ids) {
                WP_CLI::error('Нет записей с копией оригинала. Сначала запустите `wp cmsms backup`.');
            }

            $changed = 0;
            $same = 0;
            foreach ($ids as $id) {
                $original = get_post_meta($id, 'nvp_content_copy', true);
                $new = welfare_to_gutenberg($original);
                $current = get_post_field('post_content', $id);

                if ($new === $current) {
                    $same++;
                    continue;
                }

                $changed++;
                WP_CLI::log(sprintf(
                    '%s #%d %s (%d → %d байт)',
                    $dry ? '[dry-run]' : 'обновлено',
                    $id,
                    get_the_title($id),
                    strlen($current),
                    strlen($new)
                ));

                if (!$dry) {
                    $this->write($id, $new);
                    update_post_meta($id, 'cmsms_gutenberg_show', 'false');
                }
            }

            WP_CLI::success(sprintf(
                '%s: %d, без изменений: %d, всего проверено: %d.',
                $dry ? 'К обновлению' : 'Обновлено',
                $changed,
                $same,
                count($ids)
            ));
        }

        /**
         * Возвращает post_content из копии оригинала — откат миграции.
         *
         * ## OPTIONS
         *
         * [--post=<ids>]
         * : Список ID через запятую. По умолчанию — все записи с копией.
         *
         * [--dry-run]
         * : Ничего не писать, только показать, что изменится.
         *
         * ## EXAMPLES
         *
         *     wp cmsms restore --post=57271 --url=https://od-dev.tmweb.ru
         */
        public function restore($args, $assoc_args) {
            $dry = !empty($assoc_args['dry-run']);
            $ids = nv_gu_migratable_ids($this->requested_ids($assoc_args));
            if (!$ids) {
                WP_CLI::error('Нет записей с копией оригинала — восстанавливать нечего.');
            }

            $restored = 0;
            foreach ($ids as $id) {
                $original = get_post_meta($id, 'nvp_content_copy', true);
                if ($original === get_post_field('post_content', $id)) {
                    continue;
                }
                $restored++;
                WP_CLI::log(($dry ? '[dry-run] ' : '') . "#{$id} " . get_the_title($id));
                if (!$dry) {
                    $this->write($id, $original);
                }
            }

            WP_CLI::success(($dry ? 'К восстановлению' : 'Восстановлено') . ": {$restored} из " . count($ids) . '.');
        }

        /**
         * Печатает содержимое одной записи — для сравнения до и после.
         *
         * ## OPTIONS
         *
         * <id>
         * : ID записи.
         *
         * [--original]
         * : Печатать оригинал из копии, а не текущий post_content.
         *
         * [--converted]
         * : Печатать результат преобразования копии, ничего не записывая.
         *
         * ## EXAMPLES
         *
         *     wp cmsms dump 57271 --converted --url=https://od-dev.tmweb.ru
         */
        public function dump($args, $assoc_args) {
            $id = intval($args[0]);
            if (!get_post($id)) {
                WP_CLI::error("Запись #{$id} не найдена.");
            }

            if (!empty($assoc_args['original'])) {
                WP_CLI::line(get_post_meta($id, 'nvp_content_copy', true));
            } elseif (!empty($assoc_args['converted'])) {
                WP_CLI::line(welfare_to_gutenberg(get_post_meta($id, 'nvp_content_copy', true)));
            } else {
                WP_CLI::line(get_post_field('post_content', $id));
            }
        }

        private function requested_ids($assoc_args) {
            if (empty($assoc_args['post'])) {
                return [];
            }
            return array_filter(array_map('intval', explode(',', $assoc_args['post'])));
        }

        //-- Прямой UPDATE, а не wp_update_post: хук save_post этого плагина
        //-- удаляет nvp_content_copy при обновлении, то есть стирает копию,
        //-- на которой держится и повторный запуск, и откат.
        private function write($id, $content) {
            global $wpdb;
            wp_save_post_revision($id);
            $wpdb->update($wpdb->posts, ['post_content' => $content], ['ID' => $id], ['%s'], ['%d']);
            clean_post_cache($id);
        }
    }

    WP_CLI::add_command('cmsms', 'NV_GU_CLI_Command');
}

//-- выгрузка таблицы wp_posts --
add_action('wp_ajax_get_posts_pages', 'get_posts_pages');
// add_action('wp_ajax_nopriv_load_my_table', 'load_my_table_callback');
function get_posts_pages() {
    global $wpdb;
    
    $where = '';
    if (!empty($_POST['id']) && filter_var($_POST['id'], FILTER_VALIDATE_INT, ["options" => ["min_range" => 1]]) !== false) {
        $where = 'AND ID = ' . $_POST['id'];
    }
    else if (!empty($_POST['tag'])) {
        $where = "AND post_content LIKE '%{$_POST['tag']}%'";
    }
    
    $page = isset($_POST['page']) ? max(1, intval($_POST['page'])) : 1;
    $per_page = 20;
    $offset = ($page - 1) * $per_page;

    $items = $wpdb->get_results($wpdb->prepare("
        SELECT ID, post_title, post_date, post_type
          FROM {$wpdb->posts}
         WHERE post_type IN ('post', 'page') AND post_status = 'publish' {$where}
         ORDER BY ID DESC
         LIMIT %d OFFSET %d
    ", $per_page, $offset));

    $total = $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_type IN ('post', 'page') AND post_status='publish' {$where}");
    $total_pages = ceil($total / $per_page);

    ob_start();
    ?>
    <table class="my-table">
        <thead>
            <tr>
                <th>ID</th>
                <th>Заголовок</th>
                <th>Дата</th>
                <th>Тип</th>
            </tr>
        </thead>
        <tbody>
            <?php if ($items): ?>
                <?php foreach ($items as $post): ?>
                    <tr>
                        <td><button class="btn" onclick="viewItem(<?php echo $post->ID; ?>);"><?php echo $post->ID; ?></button></td>
                        <td><?php echo esc_html($post->post_title); ?></td>
                        <td><?php echo esc_html(date('d.m.Y', strtotime($post->post_date))); ?></td>
                        <td><?php echo esc_html($post->post_type); ?></td>
                    </tr>
                <?php endforeach; ?>
            <?php else: ?>
                <tr><td colspan="3">Нет данных</td></tr>
            <?php endif; ?>
        </tbody>
    </table>

    <?php if ($total_pages > 1): ?>
        <div class="my-pagination">
            <?php
            $range = 2; // сколько страниц показывать вокруг текущей
            if ($page > 1) {
                echo '<a href="#" data-page="' . ($page-1) . '">&laquo;</a>';
            }
            for ($i = 1; $i <= $total_pages; $i++) {
                if ($i == 1 || $i == $total_pages || ($i >= $page - $range && $i <= $page + $range)) {
                    echo '<a href="#" data-page="' . $i . '" class="' . ($i == $page ? 'active' : '') . '">' . $i . '</a>';
                } elseif ($i == 2 && $page > $range + 2) {
                    echo '<span>...</span>';
                } elseif ($i == $total_pages - 1 && $page < $total_pages - $range - 1) {
                    echo '<span>...</span>';
                }
            }
            if ($page < $total_pages) {
                echo '<a href="#" data-page="' . ($page + 1) . '">&raquo;</a>';
            }
            ?>
        </div>
    <?php endif;

    $table = ob_get_clean();
    
    $result = [
        'success' => true,
        'result' => $table 
    ];
    
    wp_send_json($result);

}
