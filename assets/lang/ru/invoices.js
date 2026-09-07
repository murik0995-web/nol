/* Русские строки для apps/invoices.html: платежи, остаток к оплате, повторяющиеся счета, реквизиты, нумерация по годам. */
NOL_LANG.add('ru', {
  exact: {
    /* платежи */
    'Payment': 'Платёж', 'Payments': 'Платежи', '+ Payment': '+ Платёж', 'Record payment': 'Внести платёж',
    'Save payment': 'Сохранить платёж', 'Delete payment': 'Удалить платёж',
    'Balance due': 'К оплате',
    'Reference': 'Назначение', 'Transfer number, cheque, note': 'Номер платёжки, чек, примечание',
    'Enter an amount above zero.': 'Укажите сумму больше нуля.',
    'Bank transfer': 'Банковский перевод', 'Card': 'Карта', 'Cash': 'Наличные',
    /* реквизиты на бланке */
    'Payment details': 'Реквизиты для оплаты', 'Bank details': 'Банковские реквизиты',
    'Account name, account number, bank, SWIFT/BIC': 'Получатель, номер счёта, банк, БИК',
    /* повторяющиеся счета */
    '+ Line': '+ Строка',
    'Repeat': 'Повтор', 'Next issue': 'Следующий выпуск', 'Does not repeat': 'Не повторяется',
    'Monthly': 'Ежемесячно', 'Quarterly': 'Ежеквартально',
    'A new draft from a recurring invoice.': 'Новый черновик по повторяющемуся счёту.',
    'Browser storage is full: the recurring drafts were not created.': 'Память браузера заполнена: черновики по повторяющимся счетам не созданы.',
    /* штамп на бланке */
    'DUE on receipt': 'ОПЛАТИТЬ ПРИ ПОЛУЧЕНИИ',
    /* список возможностей в пустом состоянии */
    'Payments, full or partial, with dates and method': 'Платежи, полные и частичные, с датой и способом оплаты',
    'Balance due on the paper, statuses follow the payments': 'Остаток к оплате прямо на бланке, статусы следуют за платежами',
    'Recurring invoices, monthly or quarterly, next draft on schedule': 'Повторяющиеся счета, ежемесячно или ежеквартально, следующий черновик по расписанию',
    'Bank details on the paper, numbering per year: 2026-0001': 'Банковские реквизиты на бланке, нумерация по годам: 2026-0001',
  },
  patterns: [
    [/^Balance due (.+)$/, 'К оплате $1'],
    [/^(\d+) new drafts from recurring invoices\.$/, 'Новых черновиков по повторяющимся счетам: $1.'],
    [/^Repeats (monthly|quarterly), next draft (.+)$/, (m, a, b) => 'Повторяется ' + ({ monthly: 'ежемесячно', quarterly: 'ежеквартально' }[a] || a) + ', следующий черновик ' + b],
    [/^From the recurring invoice (.+)$/, 'Из повторяющегося счёта $1'],
    [/^DUE (.+)$/, 'ОПЛАТИТЬ ДО $1'],
  ],
});
