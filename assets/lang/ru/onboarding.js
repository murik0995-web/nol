/* Русские строки для apps/onboarding.html: чек-листы для новичков, прогресс по каждому, сроки от даты выхода. Ключи из этого файла перекрывают общий словарь — только на этой странице. */
NOL_LANG.add('ru', {
  exact: {
    'NOL Onboarding · free new hire checklists': 'NOL Онбординг · бесплатные чек-листы для новичков',
    'Onboarding': 'Онбординг',
    /* панель инструментов и вкладки */
    '+ Onboarding': '+ Онбординг', '+ Template': '+ Шаблон',
    'Templates': 'Шаблоны',
    /* список людей */
    'Person': 'Человек', 'Role': 'Должность', 'Starts': 'Выходит', 'Progress': 'Прогресс', 'Next step': 'Следующий шаг', 'Status': 'Статус',
    'complete': 'пройден', 'not started': 'ещё не вышел', 'on track': 'в графике',
    /* шаблоны */
    'Template': 'Шаблон', 'Everyone': 'Для всех', 'Start somebody': 'Запустить новичка',
    'start day': 'день выхода',
    /* пустые состояния */
    'Nothing matches': 'Ничего не найдено',
    'Clear the search to see everyone.': 'Очистите поиск, чтобы увидеть всех.',
    'Clear the search to see every template.': 'Очистите поиск, чтобы увидеть все шаблоны.',
    'Nobody is onboarding yet': 'Пока никто не проходит онбординг',
    'Start somebody from a template, or import a Trainual, Enboarder or Sapling CSV. Due dates are counted from the day they start.': 'Запустите новичка по шаблону или загрузите CSV из Trainual, Enboarder или Sapling. Сроки считаются от дня выхода.',
    'No templates yet': 'Шаблонов пока нет',
    'A template is the checklist a new hire gets: a step, who owns it and how many days after the start date it is due.': 'Шаблон — это чек-лист новичка: шаг, кто за него отвечает и на какой день после выхода он должен быть готов.',
    /* редактор шагов */
    'Steps': 'Шаги', 'Step': 'Шаг', 'Owner': 'Ответственный', 'Done': 'Готово', 'Due': 'Срок',
    'Days from the start date. 0 is the first day, -3 is three days before.': 'Дни от даты выхода. 0 — первый день, −3 — за три дня до.',
    'Remove this step': 'Убрать шаг',
    'No steps yet.': 'Шагов пока нет.',
    '+ Add step': '+ Добавить шаг',
    'Day 0 is the first working day. A negative day is preparation before they arrive.': 'День 0 — первый рабочий день. Отрицательный день — подготовка до выхода.',
    /* формы */
    'New onboarding': 'Новый онбординг', 'New template': 'Новый шаблон',
    'Start date': 'Дата выхода', 'Template name': 'Название шаблона',
    'Who is joining': 'Кто выходит', 'Engineer onboarding': 'Онбординг инженера',
    'Empty checklist': 'Пустой чек-лист',
    'Send open steps to Tasks': 'Отправить открытые шаги в «Задачи»',
    'Every step still open becomes a task in Tasks, with its owner and its due date': 'Каждый незакрытый шаг станет задачей в «Задачах» — с ответственным и сроком',
    'Nothing open to send.': 'Отправлять нечего: открытых шагов нет.',
    'Nothing to export yet.': 'Пока нечего выгружать.',
    /* возможности приложения (NOL.empty) */
    'Checklist templates for new hires: a step, its owner and the day it is due': 'Шаблоны чек-листов для новичков: шаг, ответственный и день срока',
    'Due dates counted from the start date, so one template fits everybody': 'Сроки считаются от даты выхода, поэтому один шаблон подходит всем',
    'Progress per person: what is done, what is next, what is late': 'Прогресс по каждому: что сделано, что дальше, что просрочено',
    'People come from People: their first day fills the start date by itself': 'Люди берутся из «Людей»: их первый день сам подставляется в дату выхода',
    'Any open step becomes a real task in Tasks, with its owner and its date': 'Любой открытый шаг становится настоящей задачей в «Задачах» — с ответственным и датой',
    'Preparation before day one: a negative day is the week before they arrive': 'Подготовка до первого дня: отрицательный день — это неделя до выхода',
    'Import from Trainual, Enboarder, Sapling, Workable or Eddy CSV': 'Импорт CSV из Trainual, Enboarder, Sapling, Workable или Eddy',
    'Timestamped notes with @mentions on every onboarding': 'Заметки с временем и @упоминаниями на каждом онбординге',
  },
  patterns: [
    [/^(\d+) people onboarding$/, 'на онбординге: $1'],
    [/^(\d+) steps overdue$/, 'просрочено шагов: $1'],
    [/^(\d+) templates$/, 'шаблонов: $1'],
    [/^(\d+) overdue$/, 'просрочено: $1'],
    [/^(\d+) steps$/, 'шагов: $1'],
    [/^\+(\d+) more steps$/, 'ещё шагов: $1'],
    [/^day \+(\d+)$/, 'день +$1'],
    [/^day -(\d+)$/, 'день −$1'],
    [/^(\d+) steps sent to Tasks\.$/, 'шагов отправлено в «Задачи»: $1'],
    [/^Imported (\d+) steps\.$/, 'Загружено шагов: $1'],
    [/^(.+): no step or task column found\.$/, '$1: колонка с шагом или задачей не найдена.'],
  ],
});
