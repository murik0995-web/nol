/* Русские строки для apps/changelog.html: обновления продукта в Markdown, теги, отдельная HTML-страница списка изменений. */
NOL_LANG.add('ru', {
  exact: {
    'NOL Changelog · free product updates page': 'NOL Изменения · бесплатная страница обновлений продукта',
    'Changelog': 'Изменения',
    /* панель инструментов */
    'Search…': 'Поиск…',
    'Tag': 'Тег', 'All tags': 'Все теги',
    'Status': 'Статус', 'All updates': 'Все обновления', 'Published': 'Опубликовано', 'Drafts': 'Черновики', 'Draft': 'Черновик',
    'Import': 'Импорт', 'Export CSV': 'Экспорт CSV',
    'Publish HTML': 'Собрать HTML',
    'Build one HTML file with every published update, ready for GitHub Pages': 'Собрать один HTML-файл со всеми опубликованными обновлениями, готовый для GitHub Pages',
    '+ Update': '+ Обновление',
    /* теги по умолчанию */
    'Added': 'Добавлено', 'Improved': 'Улучшено', 'Fixed': 'Исправлено',
    /* список */
    'Edit': 'Изменить', 'Filter by this tag': 'Отобрать по этому тегу', 'Untitled': 'Без названия',
    'Nothing matches. Clear the search or the filters.': 'Ничего не найдено. Снимите поиск или фильтры.',
    /* пустое состояние */
    'No updates yet': 'Обновлений пока нет',
    'Write what you shipped this week, tag it, publish the page. Or import a Headway, Beamer, LaunchNotes or AnnounceKit CSV.': 'Запишите, что вы выпустили на этой неделе, поставьте теги и соберите страницу. Или импортируйте CSV из Headway, Beamer, LaunchNotes или AnnounceKit.',
    /* форма обновления */
    'New update': 'Новое обновление', 'Edit update': 'Изменить обновление',
    'Title': 'Заголовок', 'Date': 'Дата', 'Version': 'Версия', 'Tags': 'Теги',
    'What changed': 'Что изменилось', 'Markdown': 'Markdown',
    'Added, Fixed': 'Добавлено, Исправлено',
    'Delete this update?': 'Удалить это обновление?',
    'Delete': 'Удалить', 'Cancel': 'Отмена', 'Save': 'Сохранить',
    /* сборка страницы */
    'Publish the changelog page': 'Собрать страницу изменений',
    'One HTML file with every published update. No stylesheet, no scripts, nothing loaded from the network — put it on GitHub Pages, on your own site, or send it as an attachment.': 'Один HTML-файл со всеми опубликованными обновлениями. Ни таблицы стилей, ни скриптов, ничего из сети — положите его на GitHub Pages, на свой сайт или отправьте вложением.',
    'Page title': 'Заголовок страницы', 'Subtitle': 'Подзаголовок',
    'What we shipped, and when': 'Что мы выпустили и когда',
    'Download HTML': 'Скачать HTML',
    'Nothing published yet.': 'Пока ничего не опубликовано.',
    'Nothing to export yet.': 'Пока нечего экспортировать.',
    /* строка возможностей в пустом состоянии */
    'Product updates in Markdown, with a version and a date': 'Обновления продукта в Markdown, с версией и датой',
    'Tags on every entry: Added, Improved, Fixed, or your own': 'Теги на каждой записи: добавлено, улучшено, исправлено — или свои',
    'Drafts stay private until you publish them': 'Черновики остаются только у вас, пока вы их не опубликуете',
    'Publish a standalone HTML file: one file, no stylesheet, no scripts, nothing from the network': 'Отдельный HTML-файл: один файл, без таблиц стилей, без скриптов, ничего из сети',
    'Drop that file on GitHub Pages or hand it to a customer as an attachment': 'Положите этот файл на GitHub Pages или отправьте клиенту вложением',
    'Import from Headway, Beamer, LaunchNotes or AnnounceKit CSV': 'Импорт CSV из Headway, Beamer, LaunchNotes или AnnounceKit',
    'Timestamped notes with @mentions on every entry': 'Заметки с датой и @упоминаниями на каждой записи',
  },
  patterns: [
    [/^(\d+) published · (\d+) drafts?$/, 'опубликовано: $1 · черновиков: $2'],
    [/^(\d+) published · (\d+) drafts? left out$/, 'опубликовано: $1 · черновиков не вошло: $2'],
    [/^changelog\.html: (\d+) updates\.$/, 'changelog.html: обновлений — $1.'],
    [/^Imported (\d+) updates\.$/, 'Импортировано обновлений: $1.'],
    [/^(.+): no rows\.$/, '$1: нет строк.'],
    [/^(.+): no title or content column found\.$/, '$1: не найдена колонка с заголовком или текстом.'],
  ],
});
