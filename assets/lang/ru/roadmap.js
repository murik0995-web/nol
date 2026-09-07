/* Русские строки для apps/roadmap.html: доска «Сейчас / Дальше / Потом», связь пунктов с задачами, публикация статической страницы. Ключи из этого файла перекрывают общий словарь — только на этой странице. */
NOL_LANG.add('ru', {
  exact: {
    'NOL Roadmap · free product roadmap board': 'NOL Дорожная карта · бесплатная доска планов продукта',
    /* панель инструментов */
    'All themes': 'Все темы', 'Theme': 'Тема',
    'Publish': 'Опубликовать',
    'Save the public roadmap as one static HTML file': 'Сохранить публичную дорожную карту одним статическим HTML-файлом',
    '+ Item': '+ Пункт', '+ Add': '+ Добавить',
    /* доска */
    'Now': 'Сейчас', 'Next': 'Дальше', 'Later': 'Потом',
    'Shipped': 'Выпущено', 'internal': 'внутреннее',
    'Linked task': 'Связанная задача',
    'Not published on the public roadmap': 'Не публикуется на публичной странице',
    /* пустые состояния */
    'No roadmap yet': 'Дорожной карты пока нет',
    'Add what you are building now, what comes next and what waits for later. Or import a ProductPlan, Roadmunk, Canny or airfocus CSV.': 'Добавьте, что делаете сейчас, что дальше и что ждёт своего часа. Или загрузите CSV из ProductPlan, Roadmunk, Canny или airfocus.',
    'Nothing matches. Clear the search or the theme filter.': 'Ничего не найдено. Очистите поиск или фильтр по теме.',
    /* форма пункта */
    'New item': 'Новый пункт', 'Edit item': 'Изменить пункт',
    'Item': 'Пункт', 'Lane': 'Колонка', 'Owner': 'Ответственный', 'Timeframe': 'Срок',
    'Task': 'Задача', 'No task yet': 'Задачи пока нет',
    'Description': 'Описание',
    'Show on the public roadmap': 'Показывать на публичной странице',
    'Put this item on the Tasks board': 'Поставить пункт на доску «Задачи»',
    'Item → task': 'Пункт → задача', 'Open task': 'Открыть задачу',
    'Delete this roadmap item?': 'Удалить пункт дорожной карты?',
    'Task created in Tasks.': 'Задача создана в «Задачах».',
    /* публикация */
    'Publish the public roadmap': 'Публикация дорожной карты',
    'Title': 'Заголовок', 'Product roadmap': 'Дорожная карта продукта',
    'One static HTML file: no scripts, no tracking, no requests. Owners and internal items stay here.': 'Один статический HTML-файл: без скриптов, без слежки, без запросов. Ответственные и внутренние пункты остаются здесь.',
    'Download': 'Скачать',
    'Nothing to publish yet: tick “Show on the public roadmap” on an item.': 'Публиковать пока нечего: отметьте у пункта «Показывать на публичной странице».',
    'Public roadmap saved as roadmap.html. Upload it anywhere.': 'Публичная дорожная карта сохранена как roadmap.html. Выложите её где угодно.',
    /* опубликованная страница */
    'Updated': 'Обновлено', 'Nothing here yet.': 'Здесь пока пусто.',
    'Built with': 'Сделано в', 'Free and open source.': 'Бесплатно и с открытым кодом.',
    'what we are building now, what comes next, and what is on the list for later.': 'что делаем сейчас, что будет дальше и что ждёт своего часа.',
    /* список возможностей в пустом состоянии */
    'Now, Next and Later on one board, dragged between lanes': '«Сейчас», «Дальше» и «Потом» на одной доске, перетаскиванием между колонками',
    'Every item linked to a real task in Tasks, so a finished task ships the item': 'Каждый пункт связан с настоящей задачей в «Задачах»: задача выполнена — пункт выпущен',
    'Publish a public roadmap as one static HTML file: no scripts, no tracking, upload it anywhere': 'Публичная дорожная карта одним статическим HTML-файлом: без скриптов и слежки, выкладывайте куда угодно',
    'Internal items stay internal: only what you tick is published': 'Внутреннее остаётся внутренним: публикуется только то, что вы отметили',
    'Themes and timeframes on every item, filtered in one click': 'Тема и срок у каждого пункта, фильтр в один клик',
    'Owners come from People': 'Ответственные — из «Людей»',
    'Import from ProductPlan, Roadmunk, Canny, airfocus or Productboard CSV': 'Импорт CSV из ProductPlan, Roadmunk, Canny, airfocus или Productboard',
    'Timestamped notes with @mentions on every item': 'Заметки с датой и @упоминаниями на каждом пункте',
  },
  patterns: [
    [/^(\d+) items$/, 'пунктов: $1'], [/^1 item$/, '1 пункт'],
    [/^(\d+) shipped$/, 'выпущено: $1'], [/^(\d+) public$/, 'публичных: $1'],
    [/^(\d+) items will be published$/, 'будет опубликовано пунктов: $1'], [/^1 item will be published$/, 'будет опубликован 1 пункт'],
    [/^Imported (\d+) roadmap items\.$/, 'Импортировано пунктов дорожной карты: $1.'],
    [/^(.+): no item name column found\.$/, '$1: не найдена колонка с названием пункта.'],
  ],
});
