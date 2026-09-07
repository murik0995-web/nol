/* Русские строки для apps/quotes.html: прайс-лист, позиции, скидка, статусы, срок действия, связь со сделкой и счётом. */
NOL_LANG.add('ru', {
  exact: {
    /* заголовок и список */
    'Quotes': 'Предложения', 'Quote': 'Предложение', 'Quote name': 'Название предложения',
    '+ Quote': '+ Предложение', 'New quote': 'Новое предложение', 'Edit quote': 'Изменить предложение',
    '← All quotes': '← Все предложения',
    'No quotes yet': 'Предложений пока нет',
    'Build one from your price list, or import a CSV from Qwilr, Proposify, Better Proposals, PandaDoc or Zoho.': 'Соберите первое из своего прайс-листа или загрузите CSV из Qwilr, Proposify, Better Proposals, PandaDoc или Zoho.',
    'Valid until': 'Действует до', 'Prepared for': 'Кому',
    'Delete quote?': 'Удалить предложение?',
    /* статусы */
    'draft': 'черновик', 'sent': 'отправлено', 'accepted': 'принято', 'declined': 'отклонено', 'expired': 'просрочено',
    'Draft': 'Черновик', 'Sent': 'Отправлено', 'Accepted': 'Принято', 'Declined': 'Отклонено', 'Expired': 'Просрочено',
    'DRAFT': 'ЧЕРНОВИК', 'SENT': 'ОТПРАВЛЕНО', 'ACCEPTED': 'ПРИНЯТО', 'DECLINED': 'ОТКЛОНЕНО', 'EXPIRED': 'ПРОСРОЧЕНО',
    'Mark sent': 'Отметить отправленным', 'Mark accepted': 'Отметить принятым', 'Mark declined': 'Отметить отклонённым',
    /* связи */
    'Deal': 'Сделка', 'Invoice': 'Счёт', 'Not linked to a deal': 'Без сделки',
    'Create invoice': 'Создать счёт', 'Invoice created from this quote.': 'Счёт создан из этого предложения.',
    /* скидка и итоги */
    'Discount': 'Скидка', '10% or 500': '10% или 500',
    'Percent of the subtotal, or an amount off. Tax is charged on what is left.': 'Процент от суммы или сумма скидки. Налог считается с того, что осталось.',
    'Subtotal': 'Сумма', 'Tax': 'Налог', 'Total': 'Итого', 'Tax rate %': 'Ставка налога, %',
    /* прайс-лист */
    'Price list': 'Прайс-лист', 'Edit price list': 'Изменить прайс-лист', 'Save price list': 'Сохранить прайс-лист',
    'Price list saved.': 'Прайс-лист сохранён.', 'Price list line': 'Строка прайс-листа',
    'What this company sells and for how much. Every line of a quote can be picked from here. Inventory items are offered too, at their unit cost.': 'Что компания продаёт и по какой цене. Любую строку предложения можно выбрать отсюда. Позиции склада тоже предлагаются — по их себестоимости.',
    'What you sell': 'Что продаёте', 'Unit': 'Единица', 'Rate': 'Цена', 'Consulting, hour': 'Консультация, час', 'hour': 'час',
    'Pick from the price list or type your own…': 'Выберите из прайс-листа или впишите своё…',
    'Line items': 'Позиции', '+ Line': '+ Строка', 'Description': 'Описание', 'Qty': 'Кол-во', 'Amount': 'Сумма',
    'Website redesign': 'Редизайн сайта',
    'Notes / terms': 'Примечания и условия',
    'What is included, delivery time, payment terms': 'Что входит, сроки, условия оплаты',
    'From (your business)': 'От кого (ваша компания)', 'Defaults to the client name': 'По умолчанию — название клиента',
    'Company from CRM or a new one': 'Компания из CRM или новая',
    /* импорт и экспорт */
    /* список возможностей в пустом состоянии */
    'Quotes and proposals built from your own price list': 'Коммерческие предложения из вашего собственного прайс-листа',
    'Line items, a discount in percent or in money, tax and totals': 'Позиции, скидка в процентах или в деньгах, налог и итоги',
    'Statuses: draft, sent, accepted, declined, and expired on its own date': 'Статусы: черновик, отправлено, принято, отклонено и просрочено по своей дате',
    'Every quote linked to its deal in CRM': 'Каждое предложение связано со своей сделкой в CRM',
    'An accepted quote becomes an invoice in one click': 'Принятое предложение становится счётом в один клик',
    'Print to PDF on the same paper as an invoice': 'Печать в PDF на том же бланке, что и счёт',
    'Clients from CRM companies, workspace currency': 'Клиенты — компании из CRM, валюта рабочего пространства',
    'Import from Qwilr, Proposify, Better Proposals, PandaDoc or Zoho CSV': 'Импорт из CSV Qwilr, Proposify, Better Proposals, PandaDoc или Zoho',
  },
  pages: { 'quotes.html': { 'From': 'От кого', 'Issued': 'Выставлено' } }, // «От кого» и «Выставлено» — только на бланке предложения, в других приложениях From значит другое
  patterns: [
    [/^(\d+) quotes · (.+?) open( ·)?$/, 'предложений: $1 · $2 в работе$3'],
    [/^(\d+) expired$/, 'просрочено: $1'],
    [/^· (.+) accepted$/, '· принято на $1'],
    [/^Delete quote (.+)\?$/, 'Удалить предложение $1?'],
    [/^Imported (\d+) quotes\.$/, 'Загружено предложений: $1.'],
    [/^(.+): no quote number, name or client column found\.$/, '$1: не найдена колонка с номером, названием или клиентом.'],
    [/^Tax \((.+)%\)$/, 'Налог ($1%)'],
  ],
});
