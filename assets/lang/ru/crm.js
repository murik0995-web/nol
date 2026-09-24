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
    /* импорт CSV и vCard */
    'Import a CSV from HubSpot, Pipedrive, Salesforce, amoCRM or Bitrix24, a .vcf from Google Contacts, Outlook or iCloud, or add one by hand.': 'Загрузите CSV из HubSpot, Pipedrive, Salesforce, amoCRM или Битрикс24, файл .vcf из Google Контактов, Outlook или iCloud — или добавьте контакт вручную.',
    'Import a .vcf from Google Contacts, Outlook or iCloud, merged by email': 'Импорт .vcf из Google Контактов, Outlook или iCloud с объединением по почте',
    'Import from HubSpot, Pipedrive, Salesforce, amoCRM or Bitrix24 CSV': 'Импорт CSV из HubSpot, Pipedrive, Salesforce, amoCRM или Битрикс24',
    /* мастер импорта: предпросмотр и отчёт */
    'Import preview': 'Предпросмотр импорта',
    'Import report': 'Отчёт об импорте',
    'No importable rows found.': 'Нет строк для импорта.',
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
    // "Imported (\d+) contacts, (\d+) deals." is already translated in the shared assets/lang/ru.js
    [/^(\d+) merged into existing contacts\.$/, '$1 объединено с существующими контактами.'],
    [/^Skipped (\d+): no name, email or phone$/, 'Пропущено $1: нет имени, e-mail и телефона'],
    [/^Skipped (\d+): no deal name or amount$/, 'Пропущено $1: нет названия или суммы сделки'],
    [/^first (\d+) of (\d+) rows$/, 'первые $1 из $2 строк'],
    [/^(\d+) rows will be imported, (\d+) skipped\.$/, 'Будет импортировано строк: $1, пропущено: $2.'],
    [/^(\d+) rows will be imported\.$/, 'Будет импортировано строк: $1.'],
    [/^Import (\d+)$/, 'Импортировать $1'],
    [/^(\d+) closed$/, 'закрыто: $1'],
    [/^(\d+) won$/, 'выиграно: $1'],
    [/^(\d+) lost$/, 'проиграно: $1'],
    [/^(\d+) still open$/, 'в работе: $1'],
  ],
});
