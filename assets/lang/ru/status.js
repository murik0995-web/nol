/* Русские строки для apps/status.html: компоненты и их состояние, инциденты с лентой обновлений, статичная страница для GitHub Pages. */
NOL_LANG.add('ru', {
  exact: {
    'NOL Status · free status page': 'NOL Статус · бесплатная страница статуса',
    /* состояния компонентов */
    'Operational': 'Работает', 'Degraded performance': 'Работает с замедлением',
    'Partial outage': 'Частичный сбой', 'Major outage': 'Крупный сбой', 'Under maintenance': 'На обслуживании',
    /* баннер */
    'All systems operational': 'Все системы работают', 'Maintenance in progress': 'Идёт обслуживание',
    'Incident in progress': 'Идёт инцидент',
    /* статусы и влияние инцидента */
    'Investigating': 'Разбираемся', 'Identified': 'Причина найдена', 'Monitoring': 'Наблюдаем', 'Resolved': 'Решено',
    'No impact': 'Без влияния', 'Minor': 'Небольшое', 'Major': 'Серьёзное', 'Critical': 'Критическое',
    'Started': 'Начало',   /* общий словарь переводит Started как «Начал(а)»: у инцидента это время, а не глагол */
    /* панель инструментов */
    '1 component': 'компонент: 1', '1 open incident': 'открытый инцидент: 1',
    '+ Component': '+ Компонент', '+ Incident': '+ Инцидент', '+ Update': '+ Обновление',
    'Static page': 'Статичная страница',
    'Build one static HTML file you can publish on GitHub Pages': 'Собрать один HTML-файл, который можно опубликовать на GitHub Pages',
    /* разделы */
    'Components': 'Компоненты', 'Active incidents': 'Открытые инциденты', 'Past incidents': 'Прошлые инциденты',
    'Component state': 'Состояние компонента', 'Edit this component': 'Изменить этот компонент',
    'Nothing matches. Clear the search.': 'Ничего не найдено. Очистите поиск.',
    'Nothing to export yet.': 'Пока нечего выгружать.',
    /* пустое состояние */
    'No status page yet': 'Страницы статуса пока нет',
    'Add the components your customers care about, open an incident when one of them breaks, then publish a static page anyone can read.': 'Добавьте компоненты, которые важны клиентам, открывайте инцидент, когда один из них ломается, и публикуйте статичную страницу, которую прочтёт кто угодно.',
    'Components with a state each: operational, degraded, partial or major outage, maintenance': 'У каждого компонента своё состояние: работает, замедление, частичный или крупный сбой, обслуживание',
    'Incidents with a timeline: every update kept, newest first': 'Инциденты с лентой: каждое обновление сохраняется, новые сверху',
    'One overall banner computed from the components and the open incidents': 'Общий баннер считается по компонентам и открытым инцидентам',
    'Generate a standalone status page: one static HTML file for GitHub Pages': 'Сборка отдельной страницы статуса: один статичный HTML-файл для GitHub Pages',
    'The generated page carries no scripts, no trackers and no requests': 'В собранной странице нет ни скриптов, ни трекеров, ни запросов',
    'Import from Statuspage, Instatus, Hund, Better Stack or Status.io CSV': 'Импорт из CSV Statuspage, Instatus, Hund, Better Stack или Status.io',
    'Incident owners come from People': 'Ответственные за инцидент берутся из «Людей»',
    'Timestamped notes with @mentions on every incident': 'Заметки со временем и @упоминаниями на каждом инциденте',
    /* форма компонента */
    'New component': 'Новый компонент', 'Edit component': 'Изменить компонент',
    'Component': 'Компонент', 'State': 'Состояние', 'Group': 'Группа', 'Optional': 'Необязательно',
    'What your customers see when this breaks': 'Что видят клиенты, когда это ломается',
    'Delete component?': 'Удалить компонент?',
    /* форма инцидента */
    'New incident': 'Новый инцидент', 'Edit incident': 'Изменить инцидент', 'Incident': 'Инцидент',
    'Impact': 'Влияние', 'Affected components': 'Затронутые компоненты',
    'First update': 'Первое обновление', 'Add an update': 'Добавить обновление', 'Update': 'Обновление',
    'What you know, in the words a customer reads': 'Что известно — словами, которые прочитает клиент',
    'Post update': 'Опубликовать', 'Update added.': 'Обновление добавлено.', 'Incident resolved.': 'Инцидент решён.',
    'Delete incident?': 'Удалить инцидент?',
    /* статичная страница */
    'Publish a static status page': 'Опубликовать статичную страницу статуса',
    'One HTML file with your components and incidents in it. No scripts, no trackers, no requests. Commit it to a repository with GitHub Pages turned on and the page is live.': 'Один HTML-файл с вашими компонентами и инцидентами. Ни скриптов, ни трекеров, ни запросов. Положите его в репозиторий с включённым GitHub Pages — и страница работает.',
    'Page title': 'Заголовок страницы', 'Acme Status': 'Статус Ромашки',
    'Download the file below. It is called index.html.': 'Скачайте файл ниже, он называется index.html.',
    'Put it in a public repository, in the root or in a docs/ folder.': 'Положите его в публичный репозиторий — в корень или в папку docs/.',
    'Settings → Pages → deploy from that branch. Your status page is live.': 'Settings → Pages → публикация из этой ветки. Страница статуса работает.',
    'Something broke? Update it here, download again, commit again.': 'Что-то сломалось? Обновите здесь, скачайте снова, закоммитьте снова.',
    'Preview': 'Посмотреть', 'Download index.html': 'Скачать index.html',
    'Static status page saved.': 'Статичная страница статуса сохранена.',
    /* строки внутри собранной страницы */
    'Updated': 'Обновлено',
    'This page is a single static file. No trackers, no scripts, no subscription.': 'Эта страница — один статичный файл. Ни трекеров, ни скриптов, ни подписки.',
  },
  patterns: [
    [/^(\d+) components$/, 'компонентов: $1'],
    [/^(\d+) open incidents$/, 'открытых инцидентов: $1'],
    [/^Imported (\d+) components and (\d+) incidents\.$/, 'Загружено компонентов: $1, инцидентов: $2.'],
  ],
});
