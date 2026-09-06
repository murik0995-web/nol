/* Русские строки для apps/tasks.html: чек-листы, свой порядок карточек, фильтры, Markdown в описании. */
NOL_LANG.add('ru', {
  exact: {
    /* фильтры в панели инструментов */
    'All assignees': 'Все исполнители', 'Any due date': 'Любой срок', 'Overdue': 'Просрочены',
    'Due today': 'Срок сегодня', 'Due in 7 days': 'Срок в ближайшие 7 дней', 'No due date': 'Без срока',
    'Nothing matches. Clear the search or the filters.': 'Ничего не найдено. Очистите поиск или фильтры.',
    /* чек-лист внутри задачи */
    'Checklist': 'Чек-лист', 'Add a step…': 'Добавить пункт…', 'Add step': 'Добавить пункт', 'Remove step': 'Убрать пункт',
    /* список капабилити в пустом состоянии */
    'Checklists inside a task, progress on the card': 'Чек-листы внутри задачи, прогресс виден на карточке',
    'Your own card order inside a column, saved when you drag': 'Свой порядок карточек в колонке, сохраняется при перетаскивании',
    'Filter the board by assignee and by due date': 'Фильтр доски по исполнителю и по сроку',
    'Markdown in the description, with a live preview': 'Markdown в описании, с живым предпросмотром',
  },
  patterns: [
    [/^(\d+) comments?$/, 'комментариев: $1'],
  ],
});
