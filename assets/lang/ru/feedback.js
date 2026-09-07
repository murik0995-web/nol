/* Русские строки для apps/feedback.html: доска обратной связи, голоса от команды, связь идеи с задачей. Ключи из этого файла перекрывают общий словарь — только на этой странице. */
NOL_LANG.add('ru', {
  exact: {
    'NOL Feedback · free customer feedback board': 'NOL Обратная связь · бесплатная доска идей клиентов',
    /* панель инструментов */
    'All statuses': 'Все статусы', 'All areas': 'Все разделы', 'Area': 'Раздел',
    '+ Idea': '+ Идея',
    /* статусы */
    'Open': 'Открыто', 'Planned': 'Запланировано', 'In progress': 'В работе', 'Done': 'Сделано', 'Declined': 'Отклонено',
    /* список */
    'votes': 'голосов',
    'One more customer asked for this': 'Ещё один клиент попросил об этом',
    'Linked task': 'Связанная задача',
    /* пустые состояния */
    'No feedback yet': 'Обратной связи пока нет',
    'Write down what customers ask for and press the arrow every time somebody asks again. Or import a Canny, Nolt, Frill, Featurebase or UserVoice CSV.': 'Запишите, о чём просят клиенты, и нажимайте стрелку каждый раз, когда просят снова. Или загрузите CSV из Canny, Nolt, Frill, Featurebase или UserVoice.',
    'Nothing matches. Clear the search or the filters.': 'Ничего не найдено. Очистите поиск или фильтры.',
    /* форма идеи */
    'New idea': 'Новая идея', 'Edit idea': 'Изменить идею',
    'Idea': 'Идея',
    'Asked by': 'Кто попросил',
    'Votes nobody named': 'Голоса без имени',
    'First asked': 'Первый раз попросили',
    'Customers who asked, by name': 'Клиенты, которые просили, поимённо',
    'Customer who asked': 'Клиент, который попросил',
    'Add': 'Добавить',
    'Details': 'Подробности',
    'No task yet': 'Задачи пока нет',
    'Put this idea on the Tasks board': 'Поставить идею на доску «Задачи»',
    'Idea → task': 'Идея → задача', 'Open task': 'Открыть задачу',
    'Delete this idea?': 'Удалить идею?',
    'Task created in Tasks.': 'Задача создана в «Задачах».',
    'no idea column found.': 'не найдена колонка с идеей.',
    /* список возможностей в пустом состоянии */
    'Every idea a customer asked for, sorted by how many asked': 'Все идеи клиентов, отсортированные по числу просивших',
    'Votes recorded by the team: a number for the calls nobody wrote down, a name for the customers you know': 'Голоса записывает команда: число — для звонков, которые никто не записал, имя — для клиентов, которых вы знаете',
    'Which customers are behind a request, so the loudest is not confused with the biggest': 'Видно, какие клиенты стоят за просьбой: самый громкий и самый крупный — не одно и то же',
    'Statuses from open to planned, in progress, done or declined': 'Статусы: открыто, запланировано, в работе, сделано, отклонено',
    'An idea becomes a real task in Tasks and stays linked to it': 'Идея становится настоящей задачей в «Задачах» и остаётся с ней связана',
    'Requesters are CRM contacts and companies: one directory for the whole company': 'Просят контакты и компании из CRM: один справочник на всю компанию',
    'Import from Canny, Nolt, Frill, Featurebase or UserVoice CSV': 'Импорт CSV из Canny, Nolt, Frill, Featurebase или UserVoice',
    'Timestamped notes with @mentions on every idea': 'Заметки с датой и @упоминаниями на каждой идее',
    'Files on any record: attachments in your own repository': 'Файлы на любой записи: вложения в вашем репозитории',
  },
  patterns: [
    [/^(\d+) ideas$/, 'идей: $1'], [/^1 idea$/, '1 идея'],
    [/^(\d+) votes$/, 'голосов: $1'], [/^1 vote$/, '1 голос'],
    [/^(\d+) on the way$/, 'в работе и в планах: $1'],
    [/^(\d+) customers by name$/, 'клиентов поимённо: $1'],
    [/^Imported (\d+) ideas\.$/, 'Импортировано идей: $1.'],
    [/^(.+): no idea column found\.$/, '$1: не найдена колонка с идеей.'],
  ],
});
