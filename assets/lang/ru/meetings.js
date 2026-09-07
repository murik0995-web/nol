/* Русские строки для apps/meetings.html: встречи — повестка, заметки, участники, решения и поручения, которые становятся задачами. */
NOL_LANG.add('ru', {
  exact: {
    'NOL Meetings · free meeting notes': 'NOL Встречи · бесплатные заметки со встреч',
    /* заголовок и панель инструментов */
    '+ Meeting': '+ Встреча', 'All attendees': 'Все участники', 'Attendee': 'Участник',
    'Decisions': 'Решения', 'Decision': 'Решение',
    'Nothing matches. Clear the search or the filters.': 'Ничего не найдено. Очистите поиск или фильтры.',
    /* таблица */
    'When': 'Когда', 'Attendees': 'Участники', 'Action items': 'Поручения',
    'Nobody': 'Никого', 'upcoming': 'предстоит',
    'Nothing was decided yet. Open a meeting and write the decision down.': 'Решений пока нет. Откройте встречу и запишите решение.',
    /* пустое состояние */
    'No meetings yet': 'Встреч пока нет',
    'Import a Fellow, Hugo or Hypercontext CSV export, or write up your first meeting.': 'Импортируйте выгрузку CSV из Fellow, Hugo или Hypercontext либо запишите первую встречу вручную.',
    /* карточка встречи */
    'Edit meeting': 'Изменить встречу', 'New meeting': 'Новая встреча', 'Untitled meeting': 'Встреча без названия',
    'Time': 'Время', 'Agenda': 'Повестка', 'Owner': 'Ответственный',
    'Weekly sales review': 'Еженедельный разбор продаж',
    '1. What we decided last time\n2. Numbers\n3. Anything blocking': '1. Что решили в прошлый раз\n2. Цифры\n3. Что мешает',
    'What was actually said.': 'Что на самом деле обсудили.',
    'Add a person…': 'Добавить человека…', 'Add a decision…': 'Добавить решение…', 'Add an action item…': 'Добавить поручение…',
    'Add': 'Добавить', 'Remove': 'Убрать', 'Open the task': 'Открыть задачу',
    'each one becomes a task': 'каждое становится задачей',
    'Delete this meeting? It goes to Trash and can be restored. Its tasks stay in Tasks.': 'Удалить эту встречу? Она попадёт в «Корзину», откуда её можно вернуть. Созданные задачи останутся в «Задачах».',
    /* список возможностей в пустом состоянии */
    'An agenda before, Markdown notes during, decisions after': 'Повестка до встречи, заметки в Markdown во время, решения после',
    'Attendees come from People': 'Участники — это люди из «Людей»',
    'Every decision of every meeting in one log': 'Все решения всех встреч в одном журнале',
    'Action items become real tasks in Tasks, with an owner and a due date': 'Поручения становятся настоящими задачами в «Задачах» — с ответственным и сроком',
    'Import from Fellow, Hugo or Hypercontext CSV': 'Импорт CSV из Fellow, Hugo или Hypercontext',
    'Timestamped notes with @mentions on every meeting': 'Заметки с временем и @упоминаниями у каждой встречи',
    'Files on any record: attachments in your own repository': 'Файлы у любой записи: вложения в вашем собственном репозитории',
  },
  patterns: [
    [/^(\d+) meetings$/, 'встреч: $1'],
    [/^(\d+) upcoming$/, 'предстоит: $1'],
    [/^(\d+) open action items$/, 'невыполненных поручений: $1'],
    [/^1 action item added to Tasks\.$/, 'В «Задачи» добавлено поручений: 1'],
    [/^(\d+) action items added to Tasks\.$/, 'В «Задачи» добавлено поручений: $1'],
    [/^Imported (\d+) meetings\.$/, 'Импортировано встреч: $1'],
    [/^(.+): no meeting, agenda or notes column found\.$/, '$1: не найдена колонка со встречей, повесткой или заметками.'],
  ],
});
