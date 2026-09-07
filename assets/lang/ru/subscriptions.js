/* Русские строки для apps/subscriptions.html: подписки, владельцы, стоимость, цикл оплаты, продления. */
NOL_LANG.add('ru', {
  exact: {
    'NOL Subscriptions · free SaaS and vendor tracker': 'NOL Подписки · бесплатный учёт сервисов и поставщиков',
    /* заголовок и панель инструментов */
    'per month': 'в месяц', 'per year': 'в год',
    'Paste statement': 'Вставить выписку', '+ Subscription': '+ Подписка',
    'Active': 'Действующие', 'Cancelled': 'Отменённые', 'All owners': 'Все ответственные',
    'Renewing in 30 days': 'Продление за 30 дней',
    'Everything renewing in the next 30 days': 'Всё, что продлевается в ближайшие 30 дней',
    'Nothing matches. Clear the search or the filters.': 'Ничего не найдено. Очистите поиск или фильтры.',
    /* таблица */
    'Tool': 'Сервис', 'Billing': 'Оплата', 'Seats': 'Мест', 'Cost': 'Стоимость',
    'Per month': 'В месяц', 'Renews': 'Продление',
    'monthly': 'ежемесячно', 'quarterly': 'ежеквартально', 'yearly': 'ежегодно',
    'cancelled': 'отменена', 'replace with NOL': 'заменить на NOL',
    'renewal passed': 'дата продления прошла', 'renews today': 'продление сегодня', 'renews in 1 day': 'продление через 1 день',
    /* пустое состояние */
    'No subscriptions yet': 'Подписок пока нет',
    'Paste a card statement and the tools in it are recognised, import a Vendr, Zylo, Torii, Cledara, Spendflo or Sastrify CSV export, or add a tool by hand.': 'Вставьте выписку по карте — сервисы в ней распознаются сами, импортируйте выгрузку CSV из Vendr, Zylo, Torii, Cledara, Spendflo или Sastrify либо добавьте сервис вручную.',
    'Every tool you pay for: owner, seats, cost and renewal date': 'Каждый сервис, за который вы платите: ответственный, места, стоимость и дата продления',
    'Renewals inside 30 days flagged before the money leaves': 'Продления в ближайшие 30 дней видны до того, как уйдут деньги',
    'Monthly and yearly spend from any billing cycle, in one number': 'Расходы в месяц и в год из любого цикла оплаты, одним числом',
    'Paste a card statement and the tools in it are recognised': 'Вставьте выписку по карте — сервисы в ней распознаются сами',
    'Import from Vendr, Zylo, Torii, Cledara, Spendflo or Sastrify CSV': 'Импорт из CSV Vendr, Zylo, Torii, Cledara, Spendflo или Sastrify',
    'Owners come from People, the NOL app that replaces a tool is one click away': 'Ответственные берутся из Людей, а приложение NOL, которое заменяет сервис, в одном клике',
    /* карточка подписки */
    'Edit subscription': 'Изменить подписку', 'New subscription': 'Новая подписка',
    'Person from People': 'Человек из Людей',
    'Cost per billing period': 'Стоимость за период оплаты', 'Billing cycle': 'Цикл оплаты',
    'Monthly': 'Ежемесячно', 'Quarterly': 'Ежеквартально', 'Yearly': 'Ежегодно',
    'Renewal date': 'Дата продления',
    'This one has a free twin in NOL:': 'У этого сервиса есть бесплатный двойник в NOL:',
    'Renewed': 'Продлено', 'It renewed: move the date on by one billing period': 'Продлилось: перенести дату на один период оплаты',
    'Delete this subscription?': 'Удалить эту подписку?',
    /* вставка выписки */
    'Paste a statement': 'Вставьте выписку',
    'Card statement lines, an accounting export, or one tool name per line. Nothing leaves this browser. An amount on the same line is used as the monthly charge; otherwise the public list price is estimated for the team size.': 'Строки выписки по карте, выгрузка из бухгалтерии или просто по одному названию в строке. Ничего не покидает браузер. Сумма в той же строке считается ежемесячным платежом, иначе берётся публичный прайс на размер команды.',
    'Team size': 'Размер команды', 'Find tools': 'Найти сервисы', 'Close': 'Закрыть',
    'The catalogue could not be loaded, so nothing can be recognised.': 'Каталог не загрузился, распознать нечего.',
    'Nothing recognised yet. Try one tool name per line, like “Salesforce” or “Zendesk”.': 'Пока ничего не распознано. Попробуйте по одному названию в строке, например «Salesforce» или «Zendesk».',
    'from your statement': 'из вашей выписки', 'list price estimate': 'оценка по прайсу',
  },
  patterns: [
    [/^(\d+) tools$/, 'сервисов: $1'],
    [/^(\d+) renewing in 30 days$/, 'продлеваются за 30 дней: $1'],
    [/^renews in (\d+) days$/, 'продление через $1 дн.'],
    [/^(\d+) already tracked$/, 'уже учтено: $1'],
    [/^Add (\d+) subscriptions$/, 'Добавить подписки: $1'],
    [/^Added (\d+) subscriptions\.$/, 'Добавлено подписок: $1.'],
    [/^Imported: (\d+) new, (\d+) updated\.$/, 'Импортировано: новых $1, обновлено $2.'],
    [/^(.+): no tool or vendor column found\.$/, '$1: не найден столбец с сервисом или поставщиком.'],
  ],
});
