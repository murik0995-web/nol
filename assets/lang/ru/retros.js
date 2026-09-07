/* Русские строки для apps/retros.html: доски ретроспектив, голоса, поручения в «Задачи», архив. */
NOL_LANG.add('ru', {
  exact: {
    'NOL Retros · free retrospective boards': 'NOL Ретро · бесплатные доски ретроспектив',
    /* панель инструментов */
    '1 card': 'карточка: 1', '1 vote': 'голос: 1', '1 open action': 'поручение в работе: 1',
    'Search cards…': 'Поиск по карточкам…',
    'Columns': 'Колонки', 'Name, date and columns of this retro': 'Название, дата и колонки этого ретро',
    '+ Retro': '+ Ретро', '+ Card': '+ Карточка', '+ Add': '+ Добавить',
    /* переключатели */
    'Archived': 'В архиве', 'Retros you have finished and put away': 'Ретро, которые вы завершили и убрали',
    'Archive': 'В архив', 'Unarchive': 'Вернуть из архива',
    'Retro archived.': 'Ретро убрано в архив.',
    'Retro is back on the board.': 'Ретро снова на доске.',
    'Actions → Tasks': 'Поручения → Задачи',
    'Put every action item of this retro on the Tasks board': 'Положить все поручения этого ретро на доску задач',
    /* пустые состояния */
    'No retros yet': 'Ретро пока нет',
    'Run a retrospective: what went well, what to improve, what to do next. Or import a Parabol, Retrium, EasyRetro, TeamRetro or Metro Retro CSV.': 'Проведите ретроспективу: что прошло хорошо, что улучшить, что сделать дальше. Или импортируйте CSV из Parabol, Retrium, EasyRetro, TeamRetro или Metro Retro.',
    'No archived retros yet.': 'В архиве пока пусто.',
    'Nothing matches. Clear the search.': 'Ничего не найдено. Очистите поиск.',
    /* карточка на доске */
    'Vote for this card': 'Проголосовать за эту карточку',
    'Take a vote back': 'Забрать голос',
    'in Tasks': 'в задачах', 'task done': 'задача закрыта',
    '→ Task': '→ Задача',
    'Put this action item on the Tasks board': 'Положить это поручение на доску задач',
    'Action item added to Tasks.': 'Поручение добавлено в «Задачи».',
    '1 action item added to Tasks.': 'В «Задачи» добавлено 1 поручение.',
    'Every action item of this retro is already in Tasks.': 'Все поручения этого ретро уже в «Задачах».',
    /* колонки по умолчанию */
    'Went well': 'Что прошло хорошо', 'To improve': 'Что улучшить', 'Action items': 'Что сделать',
    /* форма ретро */
    'New retro': 'Новое ретро', 'Edit retro': 'Изменить ретро', 'Sprint retro': 'Ретро спринта',
    'Columns, one per line': 'Колонки, по одной в строке',
    'A column about what to do next sends its cards to Tasks. Start / Stop / Continue and Mad / Sad / Glad are understood too.': 'Колонка про то, что сделать дальше, отправляет свои карточки в «Задачи». Шаблоны Start / Stop / Continue и Mad / Sad / Glad тоже понимаются.',
    'Delete this retro? Its cards stay in Trash.': 'Удалить это ретро? Его карточки останутся в корзине.',
    /* форма карточки */
    'New card': 'Новая карточка', 'Edit card': 'Изменить карточку',
    'Card': 'Карточка', 'Column': 'Колонка', 'Author': 'Автор', 'Votes': 'Голоса',
    'Person from People': 'Человек из раздела «Люди»',
    'Card → task': 'Карточка → задача',
    'Delete card?': 'Удалить карточку?',
    /* импорт и экспорт */
    'Nothing to export yet.': 'Пока нечего экспортировать.',
    /* строка возможностей в пустом состоянии */
    'Retrospective boards: what went well, what to improve, what to do next': 'Доски ретроспектив: что прошло хорошо, что улучшить, что сделать дальше',
    'Votes on every card, so the loudest problem sorts to the top': 'Голоса на каждой карточке — самая громкая проблема оказывается наверху',
    'Action items become real tasks in Tasks, with an owner from People': 'Поручения становятся настоящими задачами в «Задачах», с ответственным из «Людей»',
    'Archive a finished retro: every board you ever ran stays readable': 'Завершённое ретро уходит в архив: все доски, которые вы когда-либо проводили, остаются под рукой',
    'Your own columns: a Start / Stop / Continue or Mad / Sad / Glad board keeps its own names': 'Свои колонки: доска Start / Stop / Continue или Mad / Sad / Glad сохраняет собственные названия',
    'Import from Parabol, Retrium, EasyRetro, TeamRetro or Metro Retro CSV': 'Импорт CSV из Parabol, Retrium, EasyRetro, TeamRetro или Metro Retro',
    'Timestamped notes with @mentions on every card': 'Заметки с датой и @упоминаниями на каждой карточке',
    /* демо-данные и карточка на главной */
    'No retro cards yet.': 'Карточек ретро пока нет.',
  },
  patterns: [
    [/^(\d+) cards$/, 'карточек: $1'],
    [/^(\d+) votes$/, 'голосов: $1'],
    [/^(\d+) open actions$/, 'поручений в работе: $1'],
    [/^(\d+) action items added to Tasks\.$/, 'В «Задачи» добавлено поручений: $1.'],
    [/^Imported (\d+) cards\.$/, 'Импортировано карточек: $1.'],
    [/^(.+): no rows\.$/, '$1: нет строк.'],
    [/^(.+): no card text column found\.$/, '$1: не найдена колонка с текстом карточки.'],
  ],
});
