/* Русские строки для apps/mindmaps.html: интеллект-карты — узлы, клавиатура, перенос ветки, экспорт в SVG. Ключи из этого файла перекрывают общий словарь — только на этой странице. */
NOL_LANG.add('ru', {
  exact: {
    'NOL Mind maps · free mind mapping': 'NOL Интеллект-карты · бесплатные карты мыслей',
    /* список возможностей в пустом состоянии */
    'A map that lays itself out: type a thought, press Tab, and the branches move over to make room': 'Карта раскладывает себя сама: пишите мысль, жмите Tab — ветки сами расходятся, освобождая место',
    'Enter for the next thought, Tab for one level in, Shift+Tab for one level out — the whole map from the keyboard': 'Enter — следующая мысль, Tab — на уровень вглубь, Shift+Tab — на уровень наружу: вся карта с клавиатуры',
    'Drag a branch onto another node and the whole subtree moves with it': 'Перетащите ветку на другой узел — вместе с ней переедет всё поддерево',
    'Collapse a branch to see the shape of the map, open it again to see the detail': 'Сверните ветку, чтобы увидеть форму карты, и раскройте снова, чтобы увидеть подробности',
    'Export the map as one SVG file: sharp at any size, no scripts, no fonts to fetch': 'Экспорт карты одним файлом SVG: чёткий при любом размере, без скриптов и без шрифтов из сети',
    'A note on any node, for what does not fit on a branch': 'Заметка на любом узле — для того, что не влезло в ветку',
    'Any node becomes a real task in Tasks, in one click': 'Любой узел одним щелчком становится настоящей задачей в «Задачах»',
    'Import an outline CSV from XMind, MindMeister, Coggle, MindManager or Mindomo': 'Загрузка CSV со структурой из XMind, MindMeister, Coggle, MindManager или Mindomo',
    /* панель инструментов */
    '+ Map': '+ Карта',
    'Map settings': 'Настройки карты', 'Export SVG': 'Экспорт SVG',
    /* пустые состояния */
    'No mind maps yet': 'Интеллект-карт пока нет',
    'Start a map, then press Tab for a child and Enter for the next thought. Or import an outline CSV from XMind, MindMeister, Coggle, MindManager or Mindomo.': 'Начните карту: Tab — ветка вглубь, Enter — следующая мысль. Или загрузите CSV со структурой из XMind, MindMeister, Coggle, MindManager или Mindomo.',
    'Nothing matches. Clear the search.': 'Ничего не найдено. Очистите поиск.',
    /* действия над узлом */
    '+ Child': '+ Ветка', '+ Sibling': '+ Соседний узел',
    'Rename': 'Переименовать', 'Add note': 'Добавить заметку', 'Edit note': 'Изменить заметку',
    'Task from node': 'Задача из узла', 'Delete node': 'Удалить узел',
    'Open this branch': 'Раскрыть ветку', 'Collapse this branch': 'Свернуть ветку',
    /* подсказка по клавишам */
    'next thought': 'следующая мысль', 'one level in': 'на уровень вглубь', 'one level out': 'на уровень наружу',
    'rename': 'переименовать', 'reorder': 'поменять местами', 'walk the map': 'ходить по карте',
    'drag a node onto another to move the whole branch': 'перетащите узел на другой, чтобы перенести всю ветку',
    /* формы */
    'New mind map': 'Новая интеллект-карта', 'Title': 'Название',
    'What is this map about?': 'О чём эта карта?',
    'Note': 'Заметка', 'Delete map': 'Удалить карту',
    'Delete this branch and everything under it?': 'Удалить эту ветку и всё, что под ней?',
    'Delete this map? It goes to Trash, with every node on it.': 'Удалить эту карту? Она уйдёт в корзину вместе со всеми узлами.',
    /* сообщения */
    'Map saved as SVG.': 'Карта сохранена в SVG.',
    'A branch cannot move inside itself.': 'Ветку нельзя перенести внутрь самой себя.',
    'Added to Tasks.': 'Добавлено в «Задачи».',
  },
  patterns: [
    [/^(\d+) maps$/, 'карт: $1'], [/^1 map$/, '1 карта'],
    [/^(\d+) nodes$/, 'узлов: $1'], [/^1 node$/, '1 узел'],
    [/^Imported (\d+) maps, (\d+) nodes\.$/, 'Загружено карт: $1, узлов: $2.'],
    [/^(.+): no topic column found\.$/, '$1: не найдена колонка с темой.'],
  ],
});
