/* Русские строки для apps/whiteboard.html: бесконечная доска, стикеры, текст, стрелки, экспорт в SVG. */
NOL_LANG.add('ru', {
  exact: {
    /* заголовок страницы и список досок */
    'NOL Whiteboard · free online whiteboard': 'NOL Доска · бесплатная онлайн-доска',
    'Whiteboard': 'Доска', 'Board': 'Доска', 'Boards': 'Доски',
    '+ Board': '+ Доска', 'New board': 'Новая доска', 'Board…': 'Доска…',
    '← All boards': '← Все доски',
    'Nothing on the wall yet': 'На доске пока пусто',
    'Start a board, or import a CSV from Miro, Mural, FigJam or Stormboard.': 'Создайте доску или загрузите CSV из Miro, Mural, FigJam или Stormboard.',
    'Nothing matches. Clear the search.': 'Ничего не найдено. Очистите поиск.',
    'Delete this board and everything on it?': 'Удалить доску и всё, что на ней?',
    /* холст */
    '+ Note': '+ Стикер', '+ Text': '+ Текст',
    'Sticky note': 'Стикер', 'Text': 'Текст', 'Note': 'Стикер',
    'Zoom in': 'Приблизить', 'Zoom out': 'Отдалить', 'Fit': 'Вписать',
    'Drag the canvas to pan, scroll to zoom, double-click it for a new note. Drag the dot on a note onto another note to draw an arrow.': 'Тяните холст, чтобы сдвинуть, крутите колесо, чтобы приблизить, двойной щелчок создаёт стикер. Перетащите точку со стикера на другой стикер, чтобы провести стрелку.',
    'Drag onto another note to draw an arrow': 'Перетащите на другой стикер, чтобы провести стрелку',
    /* форма стикера */
    'Colour': 'Цвет', 'Width': 'Ширина', 'Author': 'Автор', 'Votes': 'Голоса', 'Name': 'Название',
    'yellow': 'жёлтый', 'green': 'зелёный', 'blue': 'синий', 'pink': 'розовый', 'orange': 'оранжевый', 'grey': 'серый',
    'Make a task': 'Создать задачу',
    'Write the note first.': 'Сначала напишите текст стикера.',
    'Added to Tasks.': 'Добавлено в задачи.',
    /* экспорт и импорт */
    'Export SVG': 'Экспорт SVG',
    'Board saved as one SVG file.': 'Доска сохранена одним файлом SVG.',
    'Nothing on this board yet.': 'На этой доске пока ничего нет.',
    'Nothing to export yet.': 'Экспортировать пока нечего.',
    /* карточка на «Главной» */
    'No boards yet.': 'Досок пока нет.',
    /* пустое состояние: список возможностей */
    'An infinite canvas: sticky notes, text and arrows, panned and zoomed with the mouse': 'Бесконечный холст: стикеры, текст и стрелки, двигается и масштабируется мышью',
    'Drag a note anywhere, drag from its dot to another note to draw an arrow': 'Стикер тянется куда угодно, а от его точки к другому стикеру тянется стрелка',
    'Notes in six colours, wrapped text, votes kept from the tool you came from': 'Стикеры шести цветов, текст переносится по строкам, голоса сохраняются из прежнего сервиса',
    'Export the board as one SVG file: no scripts, no fonts to install, opens in any browser': 'Экспорт доски одним файлом SVG: без скриптов, без установки шрифтов, открывается в любом браузере',
    'A note becomes a real task in Tasks, with an owner from People': 'Стикер становится настоящей задачей в «Задачах», с исполнителем из «Людей»',
    'Import from Miro, Mural, FigJam or Stormboard CSV: frames become boards, stickies keep their colour': 'Импорт CSV из Miro, Mural, FigJam или Stormboard: фреймы становятся досками, стикеры сохраняют цвет',
    'Everything is stored in your browser and syncs through your own repository': 'Всё хранится в вашем браузере и синхронизируется через ваш репозиторий',
    'Timestamped notes with @mentions on every board': 'Заметки с датой и @упоминаниями на каждой доске',
    /* демо-доска */
    'Workshop: the customer journey': 'Воркшоп: путь клиента',
  },
  patterns: [
    [/^(\d+) boards · (\d+) notes$/, 'досок: $1 · стикеров: $2'],
    [/^(\d+) board · (\d+) notes$/, 'досок: $1 · стикеров: $2'],
    [/^(\d+) boards · (\d+) note$/, 'досок: $1 · стикеров: $2'],
    [/^(\d+) board · (\d+) note$/, 'досок: $1 · стикеров: $2'],
    [/^(\d+) notes? · (\d+) arrows?$/, 'стикеров: $1 · стрелок: $2'],
    [/^Imported (\d+) notes\.$/, 'Загружено стикеров: $1.'],
  ],
});
