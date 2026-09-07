/* Русские строки для apps/assets.html: реестр техники — устройство, серийный номер, у кого на руках, покупка, гарантия, статус. */
NOL_LANG.add('ru', {
  exact: {
    'NOL Assets · free IT asset register': 'NOL Оборудование · бесплатный учёт техники',
    /* заголовок и панель инструментов */
    'purchase value': 'стоимость покупки', '+ Asset': '+ Устройство',
    'All statuses': 'Все статусы', 'All categories': 'Все категории',
    'Warranty ending': 'Гарантия заканчивается',
    'Warranties already over or ending inside 30 days': 'Гарантии, которые уже кончились или закончатся в ближайшие 30 дней',
    'Nothing matches. Clear the search or the filters.': 'Ничего не найдено. Очистите поиск или фильтры.',
    /* статусы */
    'In use': 'В работе', 'In stock': 'На складе', 'In repair': 'В ремонте', 'Retired': 'Списано',
    /* таблица */
    'Tag': 'Инв. номер', 'Device': 'Устройство', 'Assigned to': 'У кого', 'Purchased': 'Куплено',
    'Warranty ends': 'Гарантия до', 'Cost': 'Стоимость', 'Supplier': 'Поставщик',
    'Nobody': 'Ни у кого', 'expired': 'истекла', 'ending': 'скоро истечёт',
    /* пустое состояние */
    'No assets yet': 'Техники пока нет',
    'Import a Snipe-IT, Asset Panda, AssetTiger, EZOfficeInventory or Freshservice CSV export, or add a device by hand.': 'Импортируйте выгрузку CSV из Snipe-IT, Asset Panda, AssetTiger, EZOfficeInventory или Freshservice либо добавьте устройство вручную.',
    /* карточка устройства */
    'Edit asset': 'Изменить устройство', 'New asset': 'Новое устройство',
    'Asset tag': 'Инвентарный номер', 'Serial number': 'Серийный номер',
    'Purchase date': 'Дата покупки', 'Purchase cost': 'Цена покупки',
    'Your own sticker number': 'Ваш собственный номер на наклейке',
    'From the label on the device': 'С наклейки на самом устройстве',
    'Laptop, phone, monitor…': 'Ноутбук, телефон, монитор…',
    'Person from People': 'Человек из «Людей»', 'Company from CRM': 'Компания из CRM',
    'Delete this asset? It goes to Trash and can be restored.': 'Удалить это устройство? Оно попадёт в «Корзину», откуда его можно вернуть.',
    'Check in': 'Вернуть на склад',
    'Take it back: nobody holds it, it goes to stock': 'Забрать обратно: устройство ни у кого не на руках и уходит на склад',
    'Checked in.': 'Вернули на склад.',
    /* список возможностей в пустом состоянии */
    'Every laptop, phone and monitor with its serial number and asset tag': 'Каждый ноутбук, телефон и монитор с серийным и инвентарным номером',
    'Assigned to a person from People, checked back in when they leave it': 'Закреплено за человеком из «Людей» и возвращается на склад, когда он его сдаёт',
    'Warranty end on every asset, expiring ones flagged 30 days ahead': 'Дата окончания гарантии у каждого устройства, истекающие видны за 30 дней',
    'Purchase date and cost, so the register doubles as a depreciation list': 'Дата и цена покупки — реестр заодно работает как ведомость для амортизации',
    'Import from Snipe-IT, Asset Panda, AssetTiger, EZOfficeInventory or Freshservice CSV': 'Импорт CSV из Snipe-IT, Asset Panda, AssetTiger, EZOfficeInventory или Freshservice',
    'Suppliers are CRM companies, holders are People': 'Поставщики — это компании из CRM, владельцы — из «Людей»',
  },
  patterns: [
    [/^(\d+) assets$/, 'устройств: $1'],
    [/^(\d+) in use$/, 'в работе: $1'],
    [/^(\d+) warranties ending$/, 'гарантии заканчиваются: $1'],
    [/^Imported: (\d+) new, (\d+) updated\.$/, 'Импортировано: новых $1, обновлено $2.'],
    [/^(.+): no device, serial or asset tag column found\.$/, '$1: не найдена колонка с устройством, серийным или инвентарным номером.'],
  ],
});
