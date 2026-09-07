/* Русские строки для apps/goals.html: цели и ключевые результаты по кварталам, взвешенный подсчёт, чек-ины. */
NOL_LANG.add('ru', {
  exact: {
    'NOL Goals · free OKR tracking': 'NOL Цели · бесплатный учёт OKR',
    /* панель инструментов и фильтры */
    'All quarters': 'Все кварталы', 'All owners': 'Все ответственные', 'Quarter': 'Квартал', 'Owner': 'Ответственный',
    '+ Objective': '+ Цель', '+ Key result': '+ Ключевой результат',
    'Nothing matches. Clear the search or the filters.': 'Ничего не найдено. Очистите поиск или фильтры.',
    /* пустое состояние */
    'No goals yet': 'Целей пока нет',
    'Set one objective for this quarter, give it two or three key results, and check in every week. Or import a Perdoo, Weekdone, Profit.co, Quantive or Viva Goals CSV.': 'Поставьте одну цель на квартал, добавьте к ней два-три ключевых результата и отмечайтесь раз в неделю. Или импортируйте CSV из Perdoo, Weekdone, Profit.co, Quantive или Viva Goals.',
    /* статусы */
    'on track': 'идёт по плану', 'at risk': 'под угрозой', 'behind': 'отстаёт', 'done': 'достигнута',
    'never checked in': 'без чек-инов',
    /* карточка цели и строка ключевого результата */
    'Edit objective': 'Изменить цель', 'Edit key result': 'Изменить ключевой результат', 'Check in': 'Отметиться',
    'Weight': 'Вес',
    /* формы */
    'New objective': 'Новая цель', 'New key result': 'Новый ключевой результат', 'Check in on a key result': 'Отметиться по ключевому результату',
    'Objective': 'Цель', 'Key result': 'Ключевой результат', 'Why it matters': 'Зачем это нужно', 'Progress': 'Прогресс', 'Check-in note': 'Заметка к чек-ину',
    'What are we trying to achieve this quarter?': 'Чего мы хотим добиться в этом квартале?',
    'A number that proves the objective moved': 'Число, которое доказывает, что цель сдвинулась',
    'Person from People': 'Человек из «Людей»',
    'How much of the objective this one carries': 'Какую часть цели он на себе несёт',
    'What moved, what is in the way?': 'Что сдвинулось, что мешает?',
    'Progress updated, no note.': 'Прогресс обновлён, без заметки.',
    'Delete this key result?': 'Удалить этот ключевой результат?',
    /* список возможностей в пустом состоянии */
    'Objectives and key results, by quarter': 'Цели и ключевые результаты по кварталам',
    'Progress 0–100 on every key result, weighted rollup to the objective': 'Прогресс 0–100 на каждом ключевом результате, взвешенный подсчёт по цели',
    'On track, at risk or behind, against how much of the quarter is gone': 'По плану, под угрозой или отстаёт — с оглядкой на то, сколько квартала прошло',
    'Check-ins with a note, so the number has a reason': 'Чек-ины с заметкой, чтобы у числа была причина',
    'Owners come from People': 'Ответственные берутся из «Людей»',
    'Import from Perdoo, Weekdone, Profit.co, Quantive or Viva Goals CSV': 'Импорт CSV из Perdoo, Weekdone, Profit.co, Quantive или Viva Goals',
  },
  patterns: [
    [/^(\d+) objectives · (\d+) key results · (\d+)% average$/, 'целей: $1 · ключевых результатов: $2 · в среднем $3%'],
    [/^(\d+) objectives · (\d+) key results · (\d+)% average · (\d+) behind$/, 'целей: $1 · ключевых результатов: $2 · в среднем $3% · отстают: $4'],
    [/^(\d+)% of the quarter gone$/, 'квартал пройден на $1%'],
    [/^Progress is the weighted average of (\d+) key results\.$/, 'Прогресс — взвешенное среднее по ключевым результатам, их $1.'],
    [/^Delete this objective\? Its (\d+) key results go to Trash with it\.$/, 'Удалить эту цель? Вместе с ней в корзину уйдут ключевые результаты, их $1.'],
    [/^Imported (\d+) goals\.$/, 'Импортировано целей и результатов: $1.'],
    [/^(.+): no objective or key result column found\.$/, '$1: не найдены колонки цели или ключевого результата.'],
  ],
});
