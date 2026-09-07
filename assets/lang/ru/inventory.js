/* Русские строки для apps/inventory.html: позиции со SKU, остатки, точка заказа, журнал движений. */
NOL_LANG.add('ru', {
  exact: {
    'NOL Inventory · free stock tracking': 'NOL Склад · бесплатный учёт остатков',
    /* заголовок и панель инструментов */
    'stock value': 'стоимость запасов', '+ Item': '+ Позиция', '+ Movement': '+ Движение',
    'Items': 'Позиции', 'Stock movements': 'Движения товара',
    'All locations': 'Все места хранения', 'All categories': 'Все категории',
    'Low stock': 'Мало на складе', 'Everything at or below its reorder level': 'Всё, что на точке заказа или ниже',
    'Show all items': 'Показать все позиции',
    'Nothing matches. Clear the search or the filters.': 'Ничего не найдено. Очистите поиск или фильтры.',
    /* таблицы */
    'SKU': 'Артикул', 'Location': 'Место хранения', 'On hand': 'Остаток', 'Reorder at': 'Точка заказа',
    'Value': 'Стоимость', 'Supplier': 'Поставщик', 'Movement': 'Движение', 'Change': 'Изменение',
    'Reason': 'Причина', 'By': 'Кто', 'low stock': 'мало',
    'received': 'приход', 'shipped': 'расход', 'adjusted': 'корректировка',
    /* пустые состояния */
    'No items yet': 'Позиций пока нет',
    'Import a Sortly, Zoho Inventory, inFlow, Katana or Cin7 Core CSV export, or add an item by hand.': 'Импортируйте выгрузку CSV из Sortly, Zoho Inventory, inFlow, Katana или Cin7 Core или добавьте позицию вручную.',
    'No stock movements yet': 'Движений товара пока нет',
    'Receive, ship or recount an item and every change lands here with its date, quantity and reason.': 'Оприходуйте, отгрузите или пересчитайте позицию — и каждое изменение попадёт сюда с датой, количеством и причиной.',
    /* карточка позиции */
    'Edit item': 'Изменить позицию', 'New item': 'Новая позиция',
    'Your own code for this item': 'Ваш собственный код этой позиции',
    '0 · no low-stock warning': '0 · без предупреждения об остатке',
    'Unit cost': 'Цена за единицу', 'Company from CRM': 'Компания из CRM',
    'Delete item? Its stock movements stay in the log.': 'Удалить позицию? Её движения останутся в журнале.',
    'Movements': 'Движения', 'Receive / ship': 'Приход / расход',
    /* движение товара */
    'Stock movement': 'Движение товара', 'Receive': 'Приход', 'Ship': 'Расход', 'Adjust': 'Корректировка',
    'Quantity received': 'Сколько пришло', 'Quantity shipped': 'Сколько ушло', 'Counted quantity': 'Насчитали',
    'On hand now': 'Сейчас на складе', 'Person from People': 'Человек из «Людей»',
    'Delivery, sale, stocktake…': 'Поставка, продажа, инвентаризация…',
    'Add an item first.': 'Сначала добавьте позицию.', 'Nothing changed.': 'Ничего не изменилось.',
    /* причины, которые записывает само приложение */
    'Opening stock': 'Начальный остаток', 'Edited by hand': 'Изменено вручную', 'CSV import': 'Импорт CSV',
    /* список возможностей в пустом состоянии */
    'Items with SKU, quantity, location and reorder level': 'Позиции с артикулом, количеством, местом хранения и точкой заказа',
    'Low-stock filter: everything at or below its reorder level, in one click': 'Фильтр «мало на складе»: всё, что на точке заказа или ниже, в один клик',
    'Every receipt, shipment and correction in a stock movements log': 'Каждый приход, расход и корректировка — в журнале движений товара',
    'Import from Sortly, Zoho Inventory, inFlow, Katana or Cin7 Core CSV': 'Импорт CSV из Sortly, Zoho Inventory, inFlow, Katana или Cin7 Core',
    'Suppliers are CRM companies, people are People': 'Поставщики — это компании из CRM, сотрудники — из «Людей»',
  },
  patterns: [
    [/^(\d+) items$/, 'позиций: $1'],
    [/^(\d+) low on stock$/, 'мало на складе: $1'],
    [/^Imported: (\d+) new, (\d+) updated\.$/, 'Импортировано: новых $1, обновлено $2.'],
    [/^(.+): no SKU or item name column found\.$/, '$1: не найдена колонка с артикулом или названием позиции.'],
  ],
});
