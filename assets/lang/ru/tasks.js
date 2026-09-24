/* Русские строки для apps/tasks.html: чек-листы, свой порядок карточек, фильтры, Markdown в описании, диаграмма Ганта. */
NOL_LANG.add('ru', {
  exact: {
    /* фильтры в панели инструментов */
    'All assignees': 'Все исполнители', 'Any due date': 'Любой срок', 'Overdue': 'Просрочены',
    'Due today': 'Срок сегодня', 'Due in 7 days': 'Срок в ближайшие 7 дней', 'No due date': 'Без срока',
    'Nothing matches. Clear the search or the filters.': 'Ничего не найдено. Очистите поиск или фильтры.',
    /* повторяющиеся задачи */
    'Repeat': 'Повтор', 'a new task when this one is done': 'новая задача, когда эта будет готова',
    'every day': 'каждый день', 'every week': 'каждую неделю', 'every month': 'каждый месяц',
    'Next one added': 'Следующая задача создана',
    'Repeating tasks: daily, weekly or monthly, the next one appears when you tick this one off': 'Повторяющиеся задачи: каждый день, неделю или месяц — следующая появляется, когда вы закрываете текущую',
    /* чек-лист внутри задачи */
    'Checklist': 'Чек-лист', 'Add a step…': 'Добавить пункт…', 'Add step': 'Добавить пункт', 'Remove step': 'Убрать пункт',
    /* карточка эпики завода (ZAVOD-TZ 6.8) */
    'Epic': 'Эпика',
    /* диаграмма Ганта */
    'Timeline': 'Диаграмма Ганта', 'Start': 'Начало', 'Blocked by': 'Зависит от', 'finish these first': 'их надо завершить раньше',
    'Drag a bar to move it, drag its ends to change the start or the due date.': 'Перетащите полосу, чтобы сдвинуть задачу; потяните за край, чтобы изменить начало или срок.',
    'Nothing here has a start or a due date. Open a task, give it dates, and it lands on the timeline.': 'Ни у одной задачи здесь нет ни начала, ни срока. Откройте задачу, поставьте даты — и она появится на диаграмме.',
    /* список капабилити в пустом состоянии */
    'Checklists inside a task, progress on the card': 'Чек-листы внутри задачи, прогресс виден на карточке',
    'Your own card order inside a column, saved when you drag': 'Свой порядок карточек в колонке, сохраняется при перетаскивании',
    'Filter the board by assignee and by due date': 'Фильтр доски по исполнителю и по сроку',
    'Markdown in the description, with a live preview': 'Markdown в описании, с живым предпросмотром',
    'Timeline: start and due dates as bars you drag to reschedule': 'Диаграмма Ганта: начало и срок как полосы, их можно перетаскивать',
    'Dependencies between tasks, drawn as arrows and flagged when one starts too early': 'Зависимости между задачами: стрелки на диаграмме, красные — если задача начинается слишком рано',
    /* мастер импорта: предпросмотр и отчёт */
    'Import a Trello JSON or an Asana, Jira, ClickUp, monday or Notion CSV. Or add a task.': 'Импортируйте JSON-доску Trello или CSV из Asana, Jira, ClickUp, monday или Notion. Либо добавьте задачу вручную.',
    'Import preview': 'Предпросмотр импорта',
    'Import report': 'Отчёт об импорте',
    'No importable rows found.': 'Нет строк для импорта.',
  },
  patterns: [
    [/^Next one on (.+)$/, 'Следующая — $1'],
    [/^(\d+) comments?$/, 'комментариев: $1'],
    [/^(\d+) dependenc(?:y|ies) out of order$/, 'зависимостей нарушено: $1'],
    [/^(\d+) tasks? (?:has|have) no dates and no bar$/, 'задач без дат, их нет на диаграмме: $1'],
    // "…: not a Trello board export.", "…: no task name column found." and "Imported (\d+) tasks." are already translated in the shared assets/lang/ru.js
    [/^Skipped (\d+): no task name$/, 'Пропущено $1: нет названия задачи'],
    [/^Skipped (\d+): archived card$/, 'Пропущено $1: карточка в архиве'],
    [/^Skipped (\d+): no card name$/, 'Пропущено $1: нет названия карточки'],
    [/^first (\d+) of (\d+) rows$/, 'первые $1 из $2 строк'],
    [/^(\d+) rows will be imported, (\d+) skipped\.$/, 'Будет импортировано строк: $1, пропущено: $2.'],
    [/^(\d+) rows will be imported\.$/, 'Будет импортировано строк: $1.'],
    [/^Import (\d+)$/, 'Импортировать $1'],
  ],
});
