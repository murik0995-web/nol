/* Русские строки для apps/cashflow.html: денежный поток, план на 12 месяцев, взлётная полоса. */
NOL_LANG.add('ru', {
  exact: {
    'NOL Cash flow · free cash flow forecast and runway': 'NOL Денежный поток · бесплатный прогноз и взлётная полоса',
    /* заголовок и панель инструментов */
    'Cash flow': 'Денежный поток',
    '+ Plan line': '+ Строка плана',
    'Cash on hand': 'Деньги на счету',
    'What is in the bank today: the projection starts from this number': 'Сколько сейчас на счету: с этого числа начинается прогноз',
    'Every unpaid invoice counted as money in, in the month it is due': 'Каждый неоплаченный счёт считается приходом в месяц своего срока оплаты',
    'Every active subscription counted as a monthly cost': 'Каждая действующая подписка считается ежемесячным расходом',
    /* плитки */
    'in, next 12 months': 'приход за 12 месяцев',
    'out, next 12 months': 'расход за 12 месяцев',
    'balance in 12 months': 'остаток через 12 месяцев',
    'runway': 'взлётная полоса',
    'over 12 months': 'больше 12 месяцев',
    'lowest balance': 'минимальный остаток',
    /* график */
    'Money in, money out, balance': 'Приход, расход, остаток',
    'bars are the month itself, the line is the balance after it': 'столбцы — сам месяц, линия — остаток после него',
    /* таблица месяцев */
    'Month': 'Месяц', 'In': 'Приход', 'Out': 'Расход', 'Balance': 'Остаток',
    /* таблица строк плана */
    'All lines': 'Все строки', 'Income': 'Приход', 'Costs': 'Расход',
    'Amount': 'Сумма', 'Repeats': 'Повтор', 'Starts': 'Начало', 'Ends': 'Конец',
    'Monthly': 'Ежемесячно', 'Quarterly': 'Ежеквартально', 'Yearly': 'Ежегодно', 'One-off': 'Разово',
    'Plan line': 'Строка плана',
    'Nothing matches. Clear the search or the filter.': 'Ничего не найдено. Очистите поиск или фильтр.',
    'No plan lines yet. Everything above comes from invoices and subscriptions.': 'Строк плана пока нет. Всё выше собрано из счетов и подписок.',
    /* пустое состояние */
    'No cash flow plan yet': 'Плана денежного потока пока нет',
    'Add what comes in and what goes out every month, import a Float, Pulse, Finmark, Agicap, Cashflow Frog or Dryrun export, or open an invoice and a subscription — they land in the projection on their own.': 'Добавьте, что приходит и что уходит каждый месяц, импортируйте выгрузку из Float, Pulse, Finmark, Agicap, Cashflow Frog или Dryrun — либо просто заведите счёт и подписку: они попадут в прогноз сами.',
    'Recurring income and costs, one-off items, twelve months ahead': 'Регулярные приходы и расходы, разовые платежи, на двенадцать месяцев вперёд',
    'The runway: the month the cash runs out, and how far away it is': 'Взлётная полоса: месяц, когда деньги заканчиваются, и сколько до него осталось',
    'A chart of money in, money out and the balance after every month': 'График прихода, расхода и остатка после каждого месяца',
    'Open invoices land in the month they are due, without typing them twice': 'Неоплаченные счета попадают в месяц своего срока оплаты — вводить их второй раз не нужно',
    'Every subscription you pay for counted as a monthly cost': 'Каждая оплачиваемая подписка считается ежемесячным расходом',
    'Clients and suppliers come from CRM, so a plan line knows who it is with': 'Клиенты и поставщики берутся из CRM, поэтому строка плана знает, с кем она',
    'Import from Float, Pulse, Finmark, Agicap, Cashflow Frog or Dryrun CSV': 'Импорт из CSV Float, Pulse, Finmark, Agicap, Cashflow Frog или Dryrun',
    'Timestamped notes with @mentions on every plan line': 'Заметки с датой и @упоминаниями на каждой строке плана',
    /* форма */
    'New plan line': 'Новая строка плана', 'Edit plan line': 'Строка плана',
    'Name': 'Название', 'Retainer, payroll, rent…': 'Абонплата, зарплата, аренда…',
    'Direction': 'Направление', 'Money out': 'Расход', 'Money in': 'Приход',
    'Leave empty and it repeats for as long as the projection runs': 'Оставьте пустым — строка повторяется весь срок прогноза',
    'Category': 'Категория', 'Client or supplier': 'Клиент или поставщик',
    'Company or contact from CRM': 'Компания или контакт из CRM',
    'Delete this plan line?': 'Удалить строку плана?',
    /* категории по умолчанию */
    'Sales': 'Продажи', 'Retainers': 'Поддержка', 'Payroll': 'Фонд оплаты труда', 'Rent': 'Аренда',
    'Software': 'Софт', 'Marketing': 'Маркетинг', 'Taxes': 'Налоги', 'Equipment': 'Оборудование', 'Other': 'Прочее',
    /* карточка на главной */
    'Cash flow →': 'Денежный поток →',
    'in twelve months': 'через двенадцать месяцев',
    'Over 12 months of cash': 'Денег больше чем на 12 месяцев',
    'Cash runs out': 'Деньги заканчиваются',
    'Next 12 months': 'Ближайшие 12 месяцев',
    'No cash flow plan yet.': 'Плана денежного потока пока нет.',
    /* index.html и каталог */
    'Recurring money in and out, 12 months ahead, runway': 'Регулярные приход и расход, 12 месяцев вперёд, взлётная полоса',
  },
  patterns: [
    [/^(\d+) plan lines · 12 months ahead$/, 'строк плана: $1 · на 12 месяцев вперёд'],
    [/^(\d+) plan line · 12 months ahead$/, 'строк плана: $1 · на 12 месяцев вперёд'],
    [/^(.+)\/mo$/, '$1/мес'],
    [/^Open invoices \((\d+)\)$/, 'Неоплаченные счета ($1)'],
    [/^Subscriptions \((\d+)\)$/, 'Подписки ($1)'],
    [/^(\d+) months$/, 'месяцев: $1'],
    [/^Imported (\d+) plan lines\.$/, 'Импортировано строк плана: $1.'],
    [/^(.+): no amount column found\.$/, '$1: не найден столбец с суммой.'],
  ],
});
