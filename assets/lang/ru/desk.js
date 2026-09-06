/* Russian strings for apps/desk.html: macros, SLA, merge, company link, assignee filter. */
NOL_LANG.add('ru', {
  exact: {
    /* toolbar and list */
    'All assignees': 'Все исполнители', 'Assignee': 'Исполнитель', 'Macros': 'Макросы', 'Breached': 'Просрочены',
    'No SLA breaches': 'Нарушений SLA нет', 'Every ticket is inside its target. Change the targets under SLA.': 'Все обращения укладываются в цель. Сами цели меняются кнопкой SLA.',
    /* SLA */
    'SLA targets': 'Цели SLA', 'First reply, h': 'Первый ответ, ч', 'Resolution, h': 'Решение, ч',
    'Hours counted from the moment a ticket arrives: until the first agent reply, and until it is solved. A ticket past its target is highlighted in red. These numbers are yours, set them to what you promise your customers.': 'Часы считаются с момента появления обращения: до первого ответа поддержки и до решения. Обращение, вышедшее за цель, подсвечивается красным. Это ваши числа — поставьте те, что вы обещаете клиентам.',
    'Reset to defaults': 'Вернуть по умолчанию', 'SLA targets saved.': 'Цели SLA сохранены.',
    'First reply target': 'Цель: первый ответ', 'Resolution target': 'Цель: решение', 'met': 'в срок', 'missed': 'просрочено',
    /* macros */
    'Canned replies': 'Шаблоны ответов',
    'A macro fills the reply box in one click and can move the ticket on. Variables: {{requester}}, {{first}}, {{subject}}, {{agent}}, {{company}}.': 'Макрос заполняет поле ответа в один клик и может сразу сменить статус. Переменные: {{requester}}, {{first}}, {{subject}}, {{agent}}, {{company}}.',
    'No macros yet. The one you add here appears in every ticket.': 'Макросов пока нет. Добавленный здесь появится в каждом обращении.',
    'Reply': 'Ответ', 'Also set status': 'И поставить статус', 'Leave unchanged': 'Не менять',
    'Add macro': 'Добавить макрос', 'Save macro': 'Сохранить макрос', 'Delete macro?': 'Удалить макрос?', 'Macro saved.': 'Макрос сохранён.',
    'Apply macro…': 'Применить макрос…', 'Edit macros': 'Изменить макросы', 'Close': 'Закрыть',
    /* merge */
    'Merge': 'Объединить', 'Merge this ticket into…': 'Объединить это обращение с…',
    'Messages and files move to the ticket you pick. This one goes to Trash, where it can be restored.': 'Сообщения и файлы переедут в выбранное обращение. Это отправится в Корзину, откуда его можно вернуть.',
    'Search tickets…': 'Поиск обращений…', 'No other ticket matches.': 'Других подходящих обращений нет.', 'Merged.': 'Объединено.',
    /* company link */
    'No company': 'Без компании',
    /* capability list in the empty state */
    'Canned replies with variables, applied in one click': 'Шаблоны ответов с переменными, применяются в один клик',
    'SLA targets per priority, breaches highlighted in red': 'Цели SLA по приоритетам, нарушения подсвечены красным',
    'Merge a duplicate ticket into the real one': 'Дубль обращения объединяется с основным',
    'Every ticket linked to its company page': 'Каждое обращение связано со страницей своей компании',
  },
  patterns: [
    [/^(\d+) SLA breached$/, 'нарушено SLA: $1'],
    [/^(\d+)m left$/, 'осталось $1 мин'], [/^(\d+)h left$/, 'осталось $1 ч'], [/^(\d+)d left$/, 'осталось $1 дн'],
    [/^(\d+)m over$/, 'просрочка $1 мин'], [/^(\d+)h over$/, 'просрочка $1 ч'], [/^(\d+)d over$/, 'просрочка $1 дн'],
    [/^Merged from “(.+)”$/, 'Объединено из «$1»'],
    [/^Merge “(.+)” into “(.+)”\? Messages and files move over and this ticket goes to Trash\.$/, 'Объединить «$1» с «$2»? Сообщения и файлы переедут, а это обращение уйдёт в Корзину.'],
  ],
});
