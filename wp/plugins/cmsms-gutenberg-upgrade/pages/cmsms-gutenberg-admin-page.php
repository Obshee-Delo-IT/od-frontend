<style>
    .btn {
        background-color: navy;
        color: yellow;
        font-weight: bold;
        font-size: 14px;
        cursor: pointer;
        margin: 5px;
    }
    .gb-fieldset{
      border: 1px solid #c3c3c3;
      padding: 0px;
      border-radius: 8px;
      margin: 0;
      background: #fff;
    }
    .gb-legend{
      padding: 0 0.5rem;
      font-weight: 600;
      color: #222;
      margin-left: 0.25rem;
    }
    
    .my-table {
        width: 100%;
        border-collapse: collapse;
    }
    .my-table th, .my-table td {
        border: 1px solid #ddd;
        padding: 8px;
    }
    .my-pagination {
        margin-top: 10px;
        text-align: center;
    }
    .my-pagination a {
        display: inline-block;
        margin: 0 3px;
        padding: 5px 10px;
        border: 1px solid #ddd;
        text-decoration: none;
    }
    .my-pagination a.active {
        background: #0073aa;
        color: #fff;
        font-weight: bold;
    }
    .my-pagination span {
        margin: 0 5px;
    }
    
</style>    

<div id="tabs-1">
    <ul>
      <li><a href="#tabs-11">Анализ</a></li>
      <li><a href="#tabs-12">Преобразование</a></li>
    </ul>
    <div id="tabs-11">
        <button class="btn" onclick="GetTreeOldEditor();">Дерево объектов старого редактора</button>
        <button class="btn" onclick="CopyContent1();">Сделать копию контента</button>
        <button class="btn" onclick="TransformGutenberg1();">Трансформировать в формат GUTENBERG</button>
        <button class="btn" onclick="TransformWelfare1();">Восстановить в формат WELFARE</button>
        <br/><br/>
        <table width="100%" border="1">
            <tr><th><span id="ResultSp" style="font-size: 16px;">Результаты операции.</span></th></tr>
            <tr>
                <td>
                    <div id="ResultDv" style="height: 600px; overflow: auto; padding: 5px; background-color: white; color: black;">
                        <h2>Перенесены теги:</h2>
                            <li>cmsms_row</li>
                            <li>cmsms_column</li>
                            <li>cmsms_text</li>
                            <li>cmsms_button</li>
                            <li>cmsms_divider</li>
                            <li>cmsms_gallery</li>
                            <li>cmsms_image</li>
                            <li>cmsms_heading</li>
                            <li>cmsms_blog</li>
                            <li><b>cmsms_profile</b></li>
                            Профиль в текущей теме - это тип записи profile, прототип у нее page (страница). Редактор gutenberg не умеет делать запросы 
                            по пользовательским категориям, удалось через хук добавить возможность поиска профилей по тегам (метки). Для того, чтобы
                            перенести запросы по категориям нужно копировать коды (не названия!) категорий в метки и эти метки привязать к профилям.
                            Имеется возможность выполнить эту операцию автоматически.<br/>
                            <button class="btn" onclick="MoveProfileCategoriesToTags();">Перенос категорий профилей в метки</button><br/>
                            Операция безопасна и ее можно выполнять много раз. При этом будут переноситься только новые категории и старые, если это
                            необходимо, будут удаляться.
                            <li>cmsms_toggles</li>
                            <li>cmsms_toggle</li>
                            <li>cmsms_embed</li>
                            <li>cmsms_html</li>                            
                            <li>cmsms_js</li>
                            <li>cmsms_videos / cmsms_video</li>
                    </div>
                </td>
            </tr>
        </table>
    </div>
    <div id="tabs-12">
        <table style="width: 100%;">
            <tr>
                <td style="width: 500px;">
                    <fieldset class="gb-fieldset">
                        <legend class="gb-legend">Записи и посты</legend>
                        <table style="margin: 5px;">
                            <tr>
                                <td><input id="IdIn" type="number" style="width: 100px;" placeholder="ID"></td>
                                <td><button class="btn" onclick="getRecordId();">Поиск</button></td>
                                <td><button class="btn" onclick="getAllRecords();">Выбрать все</button></td>                                
                            </tr>    
                        </table>
                        <div id="PostsDv" style="height: 610px; overflow: auto; border-top: 1px solid black; padding: 5px 0px 5px 0px;"></div>
                    </fieldset>
                </td>
                <td>
                    <fieldset class="gb-fieldset">
                        <legend id="RecordLg" class="gb-legend">Запись</legend>
                        <div id="tabs-2">
                            <ul>
                              <li>
                                  <a href="#tabs-o">Код оригинала</a>
                                  <span id="RestoreOriginalLn" onclick="restoreOriginal();" class="dashicons dashicons-download" style="margin: 5px 5px; display: none; cursor: pointer;" title="Восстановить оригинал"></span>
                              </li>
                              <li>
                                  <a href="#tabs-21">Оригинал</a>
                                  <a id="OpenOriginalLn" href="aaa" target="_blank" class="dashicons dashicons-wordpress" style="margin: 5px 5px; display: none;" title="Открыть страницу в новой вкладке"></a>
                              </li>
                              <li>
                                  <a href="#tabs-u">Код результата</a>
                                  <span id="SaveNewVersionLn" onclick="saveCopy();" class="dashicons dashicons-upload" style="margin: 5px 5px; display: none; cursor: pointer;" title="Заменить содержимое записи на результат обновления"></span>
                              </li>
                              <li><a href="#tabs-22">Результат</a></li>
                            </ul>
                            <div id="tabs-o">
                                <div style="height: 600px; overflow: auto;"><textarea id="OriginalCd" readonly style="width: 100%; height: 99%;"></textarea></div>
                            </div>
                            <div id="tabs-21">
                                <div id="OriginalDv" style="height: 600px; overflow: auto;"></div>
                            </div>
                            <div id="tabs-u">
                                <div style="height: 600px; overflow: auto;"><textarea id="UpgradeCd" readonly style="width: 100%; height: 99%;"></textarea></div>
                            </div>
                            <div id="tabs-22">
                                <div id="UpgradeDv" style="height: 600px; overflow: auto;"></div>
                            </div>
                        </div>
                    </fieldset>
                </td>
            </tr>
        </table>
    </div>
</div>

<div id="CopyContentInfoDv" style="display: none;">
    <h1 style="text-align: center; color: blue;">Сохранение копий записей</h1>
    <h2>Хотим обратить Ваше внимание на следующее:</h2>
    Данная операция создаст копии содержимого всех страниц и постов сайта в поле метаданных для каждой записи<br/>
    (таблица wp_postmeta, значение поля meta_key = 'nvp_content_copy').<br/>
    Если после создании копии запись будет отредактирована средствами wordpress, то копия этой записи будет удалена,<br/>
    таким образом Вы можете редактировать и добавлять записи без опасения потери данных.<br/>
    Перед полным преобразованием записей в формат редактора gutenberg рекомендуем вам выполнить копирование.
    <br/><br/>
    <button class="btn" onclick="CopyContent2();">Начать копирование</button>
</div>

<div id="TransformGutenbergDv" style="display: none;">
    <h1 style="text-align: center; color: blue;">Трансформация записей в формат редактора GUTENBERG</h1>
    <h2>Хотим обратить Ваше внимание на следующее:</h2>
    Данная операция заменит существующие посты и страницы на основе копий старого содержимого в терминах shortcodes темы WELFARE<br/>
    на новое содержимое в формате редактора GUTENBERG. Перенесены будут только опубликованные записи.<br/>
    После выполнения замены будьте осторожны с корректировкой старых записей через редакторы wordpress, после записи старые копии<br/>
    будут удалены безвозвратно (их можно будет восстановить только из дампов).<br/>
    Обратную операцию восстановления можно выполнить только для тех записей у которых остались копии.
    <br/><br/>
    <button class="btn" onclick="TransformGutenberg2();">Начать перенос</button>
</div>

<div id="TransformWelfareDv" style="display: none;">
    <h1 style="text-align: center; color: blue;">Восстановление записей из копий</h1>    
    <h2>Хотим обратить Ваше внимание на следующее:</h2>
    Данная операция заменит существующие посты и страницы на копии старого содержимого в терминах shortcodes темы WELFARE.<br/>
    Эту операцию можно считать восстановлением старых версий записей. Обновлены будут только опубликованные записи.<br/>
    <br/><br/>
    <button class="btn" onclick="TransformWelfare2();">Начать перенос</button>
</div>

<script>
var ajax_url = '<?php echo admin_url('admin-ajax.php'); ?>';
var nonce = '<?php echo wp_create_nonce('nv-plugin'); ?>';
var currentPost = -1;
var parms;

//-- каждый запрос к admin-ajax.php должен нести nonce --
function nvParams(fields) {
    var p = new URLSearchParams(fields);
    p.set('_ajax_nonce', nonce);
    return p;
}

jQuery(document).ready(function () {
    jQuery( "#tabs-1" ).tabs();
    jQuery( "#tabs-2" ).tabs();
} );

//--
function TransformWelfare2() {
    if (!confirm('Подтвердите пожалуйста трансформацию всех записей в формат WELFARE.')) {
        return;
    }
    //--
    jQuery('#ResultDv').html('Идет копирование контента ...');
    fetch('/wp-admin/admin-ajax.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: nvParams({
            action: 'transform_gutenberg_cmsms',
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
           jQuery('#ResultDv').html(data.result);    
        } else {
            alert('Ошибка данных: ' + data.error);            
        }
    })
    .catch(error => {
        alert('Системная ошибка');
        console.error('Системная ошибка:', error);
    });
}

//--
function TransformWelfare1() {
    jQuery('#ResultDv').html(jQuery('#TransformWelfareDv').html());
}

//--
function TransformGutenberg2() {
    if (!confirm('Подтвердите пожалуйста трансформацию всех записей в формат GUTENBERG.')) {
        return;
    }
    //--
    jQuery('#ResultDv').html('Идет копирование контента ...');
    fetch('/wp-admin/admin-ajax.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: nvParams({
            action: 'transform_cmsms_gutenberg',
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
           jQuery('#ResultDv').html(data.result);    
        } else {
            alert('Ошибка данных: ' + data.error);            
        }
    })
    .catch(error => {
        alert('Системная ошибка');
        console.error('Системная ошибка:', error);
    });
}

//--
function TransformGutenberg1() {
    jQuery('#ResultDv').html(jQuery('#TransformGutenbergDv').html());
}

//--
function MoveProfileCategoriesToTags() {
    if (!confirm('Подтвердите пожалуйста перенос категорий профилей в метки (тэги).')) {
        return;
    }
    //--
    jQuery('#ResultDv').html('Идет перенос ...');
    fetch('/wp-admin/admin-ajax.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: nvParams({
            action: 'copy_profile_categories_to_tags',
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
           jQuery('#ResultDv').html(data.result);    
        } else {
            alert('Ошибка данных: ' + data.error);            
        }
    })
    .catch(error => {
        alert('Системная ошибка');
        console.error('Системная ошибка:', error);
    });
    
}

//--
function saveCopy() {
    if (currentPost === -1) {
        return;
    }
    if (!confirm('Подтвердите пожалуйста замену страницы на обновленную версию.')) {
        return;
    }
    //--
    jQuery('#UpgradeCd').text('Идет копирование обовленной версии ...');
    fetch('/wp-admin/admin-ajax.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: nvParams({
            action: 'save_copy',
            id: currentPost
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
           alert('Произведена замена кода записи на новую верси. Ревизия для старой версии сохранена.');
           viewItem(currentPost) 
        } else {
            alert('Ошибка данных: ' + data.error);            
        }
    })
    .catch(error => {
        alert('Системная ошибка');
        console.error('Системная ошибка:', error);
    });
}

//--
function restoreOriginal() {
    if (currentPost === -1) {
        return;
    }
    if (!confirm('Подтвердите пожалуйста восстановление оригинала.')) {
        return;
    }
    //--
    jQuery('#OriginalCd').text('Идет восстановление оригинала ...');
    fetch('/wp-admin/admin-ajax.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: nvParams({
            action: 'restore_original_content',
            id: currentPost
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
           alert('Произведена замена кода записи сохраненную копию. Ревизия для предыдущей версии сохранена.');
           viewItem(currentPost) 
        } else {
            alert('Ошибка данных: ' + data.error);            
        }
    })
    .catch(error => {
        alert('Системная ошибка');
        console.error('Системная ошибка:', error);
    });
}

//--
function CopyContent2() {
    if (!confirm('Подтвердите пожалуйста копирование контента.')) {
        return;
    }
    //--
    jQuery('#ResultDv').html('Идет копирование контента ...');
    fetch('/wp-admin/admin-ajax.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: nvParams({
            action: 'copy_records_content',
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
           jQuery('#ResultDv').html(data.result);    
        } else {
            alert('Ошибка данных: ' + data.error);            
        }
    })
    .catch(error => {
        alert('Системная ошибка');
        console.error('Системная ошибка:', error);
    });
}

//--
function CopyContent1() {
    jQuery('#ResultDv').html(jQuery('#CopyContentInfoDv').html());
}

//--
function getShortcodeRecords(tag) {
    jQuery( "#tabs-1" ).tabs( "option", "active", 1 );
    parms = nvParams({
        action: 'get_posts_pages',
        tag: tag
    });
    getRecords(parms);
}
    
//--
function getRecordId() {
    jQuery('#IdIn').val(jQuery('#IdIn').val().trim());
    let id = jQuery('#IdIn').val().trim();
    if (Number.isInteger(Number(id)) && id > 0) {
        parms = nvParams({
            action: 'get_posts_pages',
            id: id
        });
        getRecords(parms);
    }
}
    
//--    
jQuery(document).on('click', '.my-pagination a', function(e) {
    e.preventDefault();
    const page = jQuery(this).data('page');
    if (page) {
        parms.set('page', page);
        /*
        let parms = nvParams({
            action: 'get_posts_pages',
            page: page
        });
        */
        getRecords(parms);
    }
});

//--
function getAllRecords() {
    parms = nvParams({
        action: 'get_posts_pages'
    });
    getRecords(parms);
}

//--
function getRecords(parms) {
    jQuery('#IdIn').val('');
    jQuery('#PostsDv').html('Загрузка записей ...');    
    fetch('/wp-admin/admin-ajax.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: parms
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
           jQuery('#PostsDv').html(data.result);    
        } else {
            alert('Ошибка данных: ' + data.error);            
        }
    })
    .catch(error => {
        alert('Системная ошибка');
        console.error('Системная ошибка:', error);
    });
}

//--
function viewItem(id) {
    currentPost = -1;
    jQuery('#OpenOriginalLn').hide();
    jQuery('#RestoreOriginalLn').hide();
    jQuery('#SaveNewVersionLn').hide();    
    jQuery('#RecordLg').text('Запись');
    jQuery("#tabs-2").tabs( "option", "active", 0 );
    jQuery('#OriginalCd').text('Загрузка контента ...')
    jQuery('#UpgradeCd').text('')            
    jQuery('#OriginalDv').html('')
    jQuery('#UpgradeDv').html('data.upgrade')
    fetch('/wp-admin/admin-ajax.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: nvParams({
            action: 'get_cmsms_gutenberg',
            id: id
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            currentPost = id;
            jQuery("#OpenOriginalLn").attr("href", data.url);
            jQuery('#OpenOriginalLn').show();
            if (data.hasCopy) {
                jQuery('#RestoreOriginalLn').show();
                jQuery('#SaveNewVersionLn').show();
            }
            jQuery('#RecordLg').text('Запись: ' + data.id + ' / ' + data.title );
            jQuery('#OriginalCd').text(data.code)
            jQuery('#UpgradeCd').text(data.upgradeCode)            
            jQuery('#OriginalDv').html(data.original)
            jQuery('#UpgradeDv').html(data.upgrade)
            document.getElementById("OriginalDv").scrollTop = 0;
            document.getElementById("UpgradeDv").scrollTop = 0;
            document.getElementById("OriginalCd").scrollTop = 0;
            document.getElementById("UpgradeCd").scrollTop = 0;            
        } else {
            alert('Ошибка данных: ' + data.error);            
        }
    })
    .catch(error => {
        alert('Системная ошибка');
        console.error('Системная ошибка:', error);
    });
}

//--
function GetTreeOldEditor() {
    showResults('Запрос дерева блоков ...');
    
    fetch('/wp-admin/admin-ajax.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: nvParams({
            action: 'get_tree_old_editor',
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showResults('<div style="font-family: Courier;">' + data.result ?? '' + '</div>');
        } else {
            showResults('Ошибка получения данных: ' + data.message);
        }
    })
    .catch(error => {
        showResults('Системная ошибка');
        console.error('Системная ошибка:', error);
    });
}

//--
function showResults(data) {
    document.getElementById('ResultDv').innerHTML = data;
}

</script>

<?php

