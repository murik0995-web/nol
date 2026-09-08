/* Русские строки для apps/crm.html: отчёты по воронке и объединение дубликатов. */
NOL_LANG.add('ru', {
  exact: {
    /* отчёты */
    'Reports': 'Отчёты',
    'No deals yet': 'Сделок пока нет',
    'Add a deal or import one, and the pipeline report fills itself.': 'Добавьте сделку или импортируйте её — и отчёт по воронке заполнится сам.',
    'closed won': 'выиграно сделок',
    'win rate': 'доля побед',
    'average won deal': 'средняя выигранная сделка',
    'Win rate': 'Доля побед',
    'Pipeline by stage': 'Воронка по этапам',
    'Pipeline by owner': 'Воронка по ответственным',
    'Closed won by month': 'Выигранные сделки по месяцам',
    'Open pipeline': 'Открытая воронка',
    'Closed won': 'Выигранные',
    'Unassigned': 'Без ответственного',
    /* дубликаты и объединение */
    'Duplicate contacts': 'Дубликаты контактов',
    'Same email or same phone. Merging keeps the fullest record, fills its blanks from the copies, moves their notes, files, deals and tickets over, and sends the copies to Trash.': 'Одна почта или один телефон. При объединении остаётся самая полная запись: пустые поля заполняются из дублей, их заметки, файлы, сделки и обращения переезжают к ней, а дубли уходят в Корзину.',
    'No duplicates. Contacts sharing an email or a phone number show up here.': 'Дубликатов нет. Сюда попадают контакты с одинаковой почтой или одинаковым телефоном.',
    'keep': 'оставим',
    'copy': 'дубль',
    'Merge': 'Объединить',
    'Merge all': 'Объединить все',
    'Merged.': 'Объединено.',
  },
  patterns: [
    [/^Duplicates \((\d+)\)$/, 'Дубликаты ($1)'],
    [/^(\d+) closed$/, 'закрыто: $1'],
    [/^(\d+) won$/, 'выиграно: $1'],
    [/^(\d+) lost$/, 'проиграно: $1'],
    [/^(\d+) still open$/, 'в работе: $1'],
  ],
});
