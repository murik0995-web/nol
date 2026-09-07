/* Русские строки для apps/contracts.html: шаблоны с подстановками, контрагенты из CRM, сроки уведомления и продления, печать договора. */
NOL_LANG.add('ru', {
  exact: {
    /* шапка и панель инструментов */
    'Contracts': 'Договоры', 'Contract': 'Договор', '+ Contract': '+ Договор',
    'Templates': 'Шаблоны', 'under contract': 'по договорам',
    /* фильтры и статусы */
    'All': 'Все', 'Draft': 'Черновики', 'Sent': 'На подписании', 'Signed': 'Подписанные', 'Terminated': 'Расторгнутые', 'Expired': 'Истёкшие',
    'draft': 'черновик', 'sent': 'на подписи', 'signed': 'подписан', 'terminated': 'расторгнут', 'expired': 'истёк', 'auto-renews': 'автопродление',
    'notice': 'уведомить', 'renews': 'продлевается', 'expires': 'истекает',
    'DRAFT': 'ЧЕРНОВИК', 'OUT FOR SIGNATURE': 'НА ПОДПИСАНИИ', 'SIGNED': 'ПОДПИСАН', 'TERMINATED': 'РАСТОРГНУТ', 'EXPIRED': 'ИСТЁК',
    /* список напоминаний */
    'Renewals and notice dates': 'Продления и сроки уведомления', 'next 90 days': 'ближайшие 90 дней',
    /* таблица */
    'Counterparty': 'Контрагент', 'Start': 'Начало', 'End': 'Окончание', 'Notice by': 'Уведомить до', 'Value': 'Сумма', 'Status': 'Статус',
    /* пустое состояние */
    'No contracts yet': 'Договоров пока нет',
    'Write one from a template, or import a CSV from PandaDoc, Concord, ContractSafe, Juro or DocuSign CLM.': 'Составьте договор по шаблону или импортируйте CSV из PandaDoc, Concord, ContractSafe, Juro или DocuSign CLM.',
    'Contract templates with {{placeholders}}, filled from CRM in one click': 'Шаблоны договоров с подстановками {{placeholders}}, заполняются из CRM в один клик',
    'Counterparties are CRM companies, signatories are CRM contacts': 'Контрагенты — это компании из CRM, подписанты — контакты из CRM',
    'Renewal and notice dates, flagged before the contract renews itself': 'Даты продления и сроки уведомления — видны до того, как договор продлится сам',
    'Statuses: draft, sent, signed, terminated': 'Статусы: черновик, на подписании, подписан, расторгнут',
    'The contract on paper: print it or save it as PDF': 'Договор на бланке: распечатать или сохранить в PDF',
    'Import from PandaDoc, Concord, ContractSafe, Juro or DocuSign CLM CSV': 'Импорт из CSV PandaDoc, Concord, ContractSafe, Juro или DocuSign CLM',
    /* карточка договора */
    '\u2190 All contracts': '\u2190 Все договоры',
    'Mark sent': 'Отправлен на подписание', 'Mark signed': 'Отметить подписанным', 'Terminate': 'Расторгнуть',
    'Print / PDF': 'Печать / PDF', 'Delete this contract?': 'Удалить этот договор?',
    'Not filled in yet:': 'Ещё не заполнено:',
    'renews itself after that': 'после этой даты продлевается сам', 'ends on that term': 'после этой даты заканчивается',
    'Between': 'Между', 'And': 'И', 'Notice': 'Уведомление',
    'No text yet. Edit this contract and pick a template.': 'Текста пока нет. Откройте «Изменить» и выберите шаблон.',
    'Name, position, date': 'ФИО, должность, дата',
    /* форма договора */
    'New contract': 'Новый договор', 'Edit contract': 'Изменить договор',
    'Title': 'Название', 'Services agreement': 'Договор оказания услуг',
    'Company from CRM or a new one': 'Компания из CRM или новая',
    'Signatory': 'Подписант', 'Contact from CRM': 'Контакт из CRM',
    'Owner': 'Ответственный', 'Who watches this one': 'Кто следит за этим договором',
    'Notice, days': 'Уведомление, дней', 'Renewal': 'Продление',
    'Renews itself unless notice is given': 'Продлевается сам, если не уведомить',
    'Your side of the contract': 'Ваша сторона договора',
    'Text': 'Текст', 'Fill from a template…': 'Заполнить по шаблону…', 'Edit templates': 'Изменить шаблоны',
    'No templates yet.': 'Шаблонов пока нет.', 'Add one': 'Добавить',
    'Placeholders:': 'Подстановки:', 'Internal notes': 'Внутренние заметки', 'Never printed on the paper': 'На бланк не попадают',
    'The text of the contract. Markdown works, {{company}} and the other placeholders are filled from CRM.': 'Текст договора. Работает Markdown, а {{company}} и другие подстановки заполняются из CRM.',
    'Replace the text with this template?': 'Заменить текст этим шаблоном?',
    /* шаблоны */
    'Contract templates': 'Шаблоны договоров',
    'A template is the text of a contract with placeholders. They are filled from the CRM company and contact of every contract you write from it.': 'Шаблон — это текст договора с подстановками. Они заполняются из компании и контакта CRM в каждом договоре, составленном по шаблону.',
    'No templates yet. The one you add here is offered in every new contract.': 'Шаблонов пока нет. Добавленный здесь предлагается в каждом новом договоре.',
    'Delete this template?': 'Удалить этот шаблон?', 'Template saved.': 'Шаблон сохранён.',
    'Save template': 'Сохранить шаблон', 'Add template': 'Добавить шаблон',
    '## 1. Parties\n\nThis agreement is made between {{us}} and {{company}} on {{today}}.': '## 1. Стороны\n\nНастоящий договор заключён между {{us}} и {{company}} {{today}}.',
  },
  patterns: [
    [/^(\d+) contracts$/, 'договоров: $1'],
    [/^(\d+) active$/, 'действующих: $1'],
    [/^(\d+) need a decision$/, 'требуют решения: $1'],
    [/^(\d+) days$/, '$1 дн.'],
    [/^Imported (\d+) contracts\.$/, 'Импортировано договоров: $1.'],
    [/^(.+): no contract name or counterparty column found\.$/, '$1: не найден столбец с названием договора или контрагентом.'],
  ],
});
