/* Русские строки для apps/standups.html: асинхронные ежедневные чек-ины, вопросы, ответы по людям и датам, история, фильтр блокеров. */
NOL_LANG.add('ru', {
  exact: {
    'NOL Standups · free async daily check-ins': 'NOL Стендапы · бесплатные асинхронные чек-ины',
    'Standups': 'Стендапы',
    /* панель инструментов */
    'Search answers…': 'Поиск по ответам…',
    'Questions': 'Вопросы', '+ Standup': '+ Стендап', '+ Check-in': '+ Чек-ин',
    'Import CSV': 'Импорт CSV', 'Export CSV': 'Экспорт CSV',
    'Questions and participants of this standup': 'Вопросы и участники этого стендапа',
    /* переключатели и навигация по дням */
    'Day': 'День', 'History': 'История', 'Blockers only': 'Только блокеры',
    'Only the check-ins where somebody is stuck': 'Только чек-ины, где кто-то застрял',
    'Today': 'Сегодня', 'Previous day': 'Предыдущий день', 'Next day': 'Следующий день',
    /* пустые состояния */
    'No standups yet': 'Стендапов пока нет',
    'Ask three questions once a day and let people answer when they can. Or import a Geekbot, Standuply, DailyBot, Range or Jell CSV.': 'Задайте три вопроса раз в день, и пусть каждый ответит, когда ему удобно. Или импортируйте CSV из Geekbot, Standuply, DailyBot, Range или Jell.',
    'Nobody has written yet on this day.': 'В этот день ещё никто не написал.',
    'Nothing matches. Clear the search or the filter.': 'Ничего не найдено. Очистите поиск или фильтр.',
    /* карточка чек-ина и таблица истории */
    'blocked': 'заблокирован', 'No answer': 'Без ответа',
    'Still to write': 'Ещё не написали', 'Write this check-in': 'Написать этот чек-ин',
    'Date': 'Дата', 'Person': 'Человек', 'Answers': 'Ответы', 'Blocker': 'Блокер',
    /* форма чек-ина */
    'New check-in': 'Новый чек-ин', 'Edit check-in': 'Изменить чек-ин',
    'Person from People': 'Человек из раздела «Люди»',
    'Mark this check-in as blocked': 'Отметить, что человек заблокирован',
    'Blocker → task': 'Блокер → задача', 'Put the blocker on the Tasks board': 'Положить блокер на доску задач',
    'Delete check-in?': 'Удалить чек-ин?',
    'Task created from the blocker.': 'Из блокера создана задача.',
    'This check-in has no blocker to move.': 'В этом чек-ине нет блокера, который можно перенести.',
    /* форма стендапа */
    'New standup': 'Новый стендап', 'Edit standup': 'Изменить стендап', 'Standup': 'Стендап',
    'Name': 'Название',
    'Questions, one per line': 'Вопросы, по одному в строке',
    'Participants, one name per line': 'Участники, по одному имени в строке',
    'People from People': 'Люди из раздела «Люди»',
    'A question about blockers marks a check-in automatically when the answer is not “no”.': 'Вопрос про блокеры сам помечает чек-ин, если ответ на него не «нет».',
    'Delete this standup? Its check-ins stay in Trash.': 'Удалить этот стендап? Его чек-ины останутся в корзине.',
    /* общие кнопки формы */
    'Save': 'Сохранить', 'Cancel': 'Отмена', 'Delete': 'Удалить',
    /* импорт и экспорт */
    'Nothing to export yet.': 'Пока нечего экспортировать.',
    /* вопросы стендапа по умолчанию и демо-данные */
    'Daily standup': 'Ежедневный стендап',
    'What did you do yesterday?': 'Что вы сделали вчера?',
    'What will you do today?': 'Что вы сделаете сегодня?',
    'Anything blocking you?': 'Что вам мешает?',
    /* строка возможностей в пустом состоянии */
    'Async daily check-ins: your questions, answered when people have time': 'Асинхронные ежедневные чек-ины: ваши вопросы, ответы — когда людям удобно',
    'Who answered today and who is still to write, per standup': 'Кто уже ответил сегодня и кто ещё не написал, по каждому стендапу',
    'Blockers filter: only the people who are stuck, across every day': 'Фильтр блокеров: только те, кто застрял, за любой день',
    'Full history by date and by person, searchable': 'Полная история по датам и людям, с поиском',
    'Several standups at once, each with its own questions and participants': 'Несколько стендапов сразу, у каждого свои вопросы и участники',
    'Participants come from People, blockers can become a task in Tasks': 'Участники берутся из «Людей», а блокер одним кликом становится задачей',
    'Import from Geekbot, Standuply, DailyBot, Range or Jell CSV': 'Импорт CSV из Geekbot, Standuply, DailyBot, Range или Jell',
    'Timestamped notes with @mentions on every check-in': 'Заметки с датой и @упоминаниями на каждом чек-ине',
    'No check-ins yet.': 'Чек-инов пока нет.',
  },
  patterns: [
    [/^(\d+) answered$/, 'ответили: $1'],
    [/^(\d+) still to write$/, 'ещё не написали: $1'],
    [/^(\d+) blocked$/, 'заблокированы: $1'],
    [/^Imported (\d+) check-ins\.$/, 'Импортировано чек-инов: $1.'],
    [/^(.+): no rows\.$/, '$1: нет строк.'],
    [/^(.+): no question columns found\.$/, '$1: не найдены колонки с вопросами.'],
  ],
});
