/* Русские строки для apps/helpcenter.html и для сайта, который он генерирует: выбор папки вики, публикация, скачивание файлов, импорт статей. */
NOL_LANG.add('ru', {
  exact: {
    'NOL Help center · free public knowledge base': 'NOL Справка · бесплатная публичная база знаний',
    'Turn a Wiki folder into a public help center: static HTML with search, downloaded as a set of files or as one self-contained page. No zip, no server, no build step. Free, open source, runs in your browser. Imports Zendesk Guide, Help Scout Docs, HelpDocs and Intercom Articles CSV exports.': 'Превратите папку вики в публичную справку: статический HTML с поиском, который скачивается набором файлов или одной самодостаточной страницей. Без архива, без сервера, без сборки. Бесплатно, открытый исходный код, работает в браузере. Импортирует выгрузки Zendesk Guide, Help Scout Docs, HelpDocs и Intercom Articles в CSV.',

    /* шапка */
    'from the Wiki folder': 'из папки вики',
    'from every Wiki page': 'из всех страниц вики',
    'Search articles…': 'Поиск по статьям…',
    '+ Article': '+ Статья',

    /* настройки сайта */
    'Site title': 'Название сайта',
    'Tagline': 'Подзаголовок',
    'Help center': 'Справка',
    'Answers to the questions people actually ask': 'Ответы на вопросы, которые задают чаще всего',
    'Wiki folder to publish': 'Какую папку вики публиковать',
    'Every page in the Wiki': 'Все страницы вики',
    'Download files': 'Скачать файлы',
    'Download one HTML': 'Скачать одним HTML',
    'Preview': 'Посмотреть',
    'No zip: the files land in your downloads folder one by one, ready to upload anywhere. Your browser asks once to allow several downloads.': 'Без архива: файлы падают в загрузки по одному, готовые к заливке куда угодно. Браузер один раз спросит разрешение на несколько скачиваний.',
    'One pasted image lives in your workspace and is left out of the public site.': 'Одна вставленная картинка лежит в вашем рабочем пространстве и в публичный сайт не попадёт.',

    /* список статей */
    'Articles': 'Статьи',
    'Publish this article': 'Публиковать эту статью',
    'Nothing matches your search.': 'Ничего не найдено.',
    'No pages to publish yet': 'Публиковать пока нечего',
    'A help center is made of Wiki pages. Write one in the Wiki, or import your Zendesk Guide, Help Scout Docs, HelpDocs or Intercom Articles export as CSV.': 'Справка собирается из страниц вики. Напишите страницу в Вики или импортируйте выгрузку Zendesk Guide, Help Scout Docs, HelpDocs или Intercom Articles в CSV.',

    /* новая статья */
    'New article': 'Новая статья',
    'Title': 'Заголовок',
    'Section': 'Раздел',
    'How do I reset my password?': 'Как сбросить пароль?',
    'Getting started': 'Первые шаги',
    'The text is written in the Wiki, in Markdown. This opens the editor there.': 'Текст пишется в Вики, в Markdown. Кнопка откроет там редактор.',
    'Write it': 'Написать',

    /* уведомления */
    'Nothing to publish yet.': 'Публиковать пока нечего.',
    'Saved as one file. Open it anywhere, search works offline.': 'Сохранено одним файлом. Откройте его где угодно — поиск работает без сети.',
    'Your browser blocked the preview window. Allow pop-ups for this page.': 'Браузер заблокировал окно предпросмотра. Разрешите всплывающие окна для этой страницы.',
    'That file has no rows.': 'В этом файле нет строк.',
    'No article title or body column in that file.': 'В этом файле нет колонки с заголовком или текстом статьи.',
    'Imported 1 article.': 'Импортирована 1 статья.',
    'Exported.': 'Выгружено.',
    'Untitled': 'Без названия',

    /* сгенерированный сайт */
    'Search the help center…': 'Поиск по справке…',
    'Search results': 'Результаты поиска',
    'Nothing found. Try another word.': 'Ничего не нашлось. Попробуйте другое слово.',
    '← All articles': '← Все статьи',
    'These pages are plain static files. No server, no cookies, no tracking.': 'Эти страницы — обычные статические файлы. Ни сервера, ни куки, ни слежки.',

    /* пустой экран: список возможностей */
    'A public help center generated from your Wiki pages': 'Публичная справка, собранная из страниц вашей вики',
    'Static HTML you can host anywhere: no server, no database, no build step': 'Статический HTML, который можно положить куда угодно: без сервера, без базы, без сборки',
    'Search across every article, working from a file:// folder': 'Поиск по всем статьям, работает даже из папки на диске',
    'Download the whole site as separate files, or as one self-contained HTML': 'Скачать весь сайт отдельными файлами или одним самодостаточным HTML',
    'Pick the Wiki folder to publish; subfolders become sections': 'Выберите папку вики для публикации: подпапки станут разделами',
    'Hide a draft page without deleting it': 'Спрятать черновик, не удаляя его',
    'Links between wiki pages become links between articles': 'Ссылки между страницами вики становятся ссылками между статьями',
    'Import from Zendesk Guide, Help Scout Docs, HelpDocs or Intercom Articles CSV': 'Импорт из CSV Zendesk Guide, Help Scout Docs, HelpDocs или Intercom Articles',
  },
  patterns: [
    [/^(\d+) articles$/, 'статей: $1'],
    [/^1 article$/, '1 статья'],
    [/^Downloading (\d+) files\.$/, 'Скачиваем файлов: $1.'],
    [/^(\d+) images were left out: they live in your workspace, not on a public site\.$/, 'Картинок не попало в сайт: $1. Они лежат в вашем рабочем пространстве, а не на публичном сайте.'],
    [/^(\d+) pasted images live in your workspace and are left out of the public site\.$/, 'Вставленных картинок в рабочем пространстве: $1. В публичный сайт они не попадут.'],
    [/^Imported (\d+) articles\.$/, 'Импортировано статей: $1.'],
  ],
});
