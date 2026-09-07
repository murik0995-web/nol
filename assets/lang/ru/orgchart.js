/* Русские строки для apps/orgchart.html: оргструктура из поля «Руководитель» в разделе «Люди», свёртка веток, печать и отчёт о пропущенных руководителях. */
NOL_LANG.add('ru', {
  exact: {
    'NOL Org chart · free org chart from your employee directory': 'NOL Оргструктура · бесплатная схема подчинения из справочника сотрудников',
    /* переключатели видов и панель инструментов */
    'Chart': 'Схема', 'Missing managers': 'Пропущенные руководители',
    'Collapse all': 'Свернуть всё', 'Expand all': 'Развернуть всё', 'Print / PDF': 'Печать / PDF',
    /* схема */
    'Show the people under this one': 'Показать людей под этим человеком',
    'Hide the people under this one': 'Скрыть людей под этим человеком',
    /* пустые состояния */
    'No org chart yet': 'Оргструктуры пока нет',
    'The chart is drawn from the Manager field in People. Import a BambooHR, Gusto, Rippling, Pingboard, ChartHop or Organimi CSV, or add people by hand.': 'Схема строится по полю «Руководитель» в разделе «Люди». Импортируйте CSV из BambooHR, Gusto, Rippling, Pingboard, ChartHop или Organimi либо добавьте людей вручную.',
    'Nobody matches.': 'Никто не найден.',
    'Clear the search to see the whole company again.': 'Очистите поиск, чтобы снова увидеть всю компанию.',
    /* отчёт о пропущенных руководителях */
    'Every reporting line is complete.': 'Все линии подчинения на месте.',
    'Everybody has a manager who is in the directory, and no branch loops back on itself.': 'У каждого есть руководитель из справочника, и ни одна ветка не замыкается сама на себя.',
    'Reports': 'Подчинённых', 'Problem': 'Что не так', 'Manager typed': 'Записанный руководитель',
    'Top of the company': 'Вершина компании', 'No manager set': 'Руководитель не указан',
    'Manager not in the directory': 'Руководителя нет в справочнике', 'Manager loop': 'Кольцо подчинения',
    /* форма человека */
    'Leave empty for the top of the company': 'Оставьте пустым для вершины компании',
    'The chart follows this one field. A name that belongs to nobody in the directory shows up in the report.': 'Схема строится по этому одному полю. Имя, которого нет в справочнике, попадёт в отчёт.',
    /* список возможностей в пустом состоянии */
    'The whole company as one chart, drawn from the Manager field in People': 'Вся компания одной схемой, построенной по полю «Руководитель» в разделе «Люди»',
    'Collapse a branch to see the shape, expand it to see the names': 'Сверните ветку, чтобы увидеть форму, разверните, чтобы увидеть имена',
    'Print the chart or save it as PDF, on one page': 'Распечатайте схему или сохраните её в PDF, на одной странице',
    'Everyone without a manager, with a manager nobody knows, or inside a loop, in one report': 'Все без руководителя, с неизвестным руководителем или внутри кольца — в одном отчёте',
    'Search a name and see the line above and below it': 'Найдите имя и увидите линию над ним и под ним',
    'Import from BambooHR, Gusto, Rippling, Pingboard, ChartHop, OrgChart Now or Organimi CSV': 'Импорт CSV из BambooHR, Gusto, Rippling, Pingboard, ChartHop, OrgChart Now или Organimi',
    'Export the reporting lines with a level and a headcount per person': 'Экспорт линий подчинения с уровнем и числом людей под каждым',
  },
  patterns: [
    [/^(\d+) people · (\d+) levels deep · (\d+) to fix$/, 'людей: $1 · уровней: $2 · требует внимания: $3'],
  ],
});
