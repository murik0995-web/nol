/* Русские строки для apps/hiring.html: вакансии, кандидаты, доска этапов, импорт из ATS. Ключи из этого файла перекрывают общий словарь — только на этой странице. */
NOL_LANG.add('ru', {
  exact: {
    'NOL Hiring · free applicant tracking': 'NOL Наём · бесплатный подбор персонала',
    /* панель инструментов и вкладки */
    'Job': 'Вакансия', 'All jobs': 'Все вакансии', '+ Job': '+ Вакансия', '+ Candidate': '+ Кандидат',
    'Candidates': 'Кандидаты', 'Jobs': 'Вакансии',
    /* доска этапов */
    'Applied': 'Отклик', 'Screen': 'Скрининг', 'Interview': 'Интервью', 'Offer': 'Оффер', 'Hired': 'Нанят', 'Rejected': 'Отказ',
    'Nothing matches. Clear the search or the job filter.': 'Ничего не найдено. Очистите поиск или фильтр по вакансии.',
    'Nothing matches. Clear the search.': 'Ничего не найдено. Очистите поиск.',
    'No candidates yet': 'Кандидатов пока нет',
    'Import a CSV from Greenhouse, Lever, Workable, Breezy HR or Recruitee. Or add a candidate by hand.': 'Импортируйте CSV из Greenhouse, Lever, Workable, Breezy HR или Recruitee. Или добавьте кандидата вручную.',
    /* таблица вакансий */
    'No jobs yet': 'Вакансий пока нет',
    'Add a job, or import an ATS export — jobs are created from its job column.': 'Добавьте вакансию или импортируйте выгрузку из ATS — вакансии создадутся из её колонки с должностью.',
    'Department': 'Отдел', 'In progress': 'В работе', 'Hires': 'Нанято', 'Hiring manager': 'Нанимающий менеджер',
    'Show the candidates for this job': 'Показать кандидатов по этой вакансии',
    'Open': 'Открыта', 'On hold': 'На паузе', 'Closed': 'Закрыта',
    'Full-time': 'Полная занятость', 'Part-time': 'Частичная занятость', 'Contract': 'Договор подряда', 'Internship': 'Стажировка',
    /* карточка вакансии */
    'New job': 'Новая вакансия', 'Edit job': 'Изменить вакансию', 'Job title': 'Название вакансии', 'Opened': 'Открыта с',
    'Delete this job? Its candidates stay.': 'Удалить вакансию? Её кандидаты останутся.',
    /* карточка кандидата */
    'New candidate': 'Новый кандидат', 'Edit candidate': 'Изменить кандидата', 'Candidate': 'Кандидат',
    'Source': 'Источник', 'Where they came from': 'Откуда пришёл', 'Recruiter': 'Рекрутер',
    'Profile or CV link': 'Ссылка на профиль или резюме', '— no job —': '— без вакансии —',
    'Delete this candidate?': 'Удалить кандидата?',
    /* список возможностей в пустом состоянии */
    'Jobs and candidates in one place': 'Вакансии и кандидаты в одном месте',
    'Stage board with drag and drop, your own card order inside a column': 'Доска этапов с перетаскиванием, свой порядок карточек внутри колонки',
    'Import from Greenhouse, Lever, Workable, Breezy HR, Recruitee or Teamtailor CSV': 'Импорт из CSV Greenhouse, Lever, Workable, Breezy HR, Recruitee или Teamtailor',
    'Stage names from your old ATS mapped onto the board automatically': 'Названия этапов из прежней ATS сами раскладываются по доске',
    'Source on every candidate: where the hire came from': 'Источник у каждого кандидата: откуда пришёл человек',
    'Resumes attached to the candidate, in your own repository': 'Резюме прикреплены к кандидату, в вашем собственном репозитории',
    'Timestamped notes with @mentions on every candidate': 'Заметки с отметкой времени и @упоминаниями у каждого кандидата',
    'Hiring managers and recruiters come from People': 'Нанимающие менеджеры и рекрутеры берутся из «Людей»',
  },
  patterns: [
    [/^(\d+) open jobs · (\d+) candidates · (\d+) in progress · (\d+) hired$/, 'открытых вакансий: $1 · кандидатов: $2 · в работе: $3 · нанято: $4'],
    [/^(\d+) notes?$/, 'заметок: $1'],
    [/^(.+): no candidate name column found\.$/, '$1: не найдена колонка с именем кандидата.'],
    [/^Imported (\d+) candidates\.$/, 'Импортировано кандидатов: $1.'],
    [/^Imported (\d+) jobs\.$/, 'Импортировано вакансий: $1.'],
  ],
});
