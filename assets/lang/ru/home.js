/* Русские строки для apps/home.html: карточки остатков склада и подписок. */
NOL_LANG.add('ru', {
  exact: {
    'Stock': 'Склад', 'Inventory →': 'Склад →', 'low stock': 'мало',
    'Everything is above its reorder level.': 'Всё выше точки заказа.',
    'No items yet.': 'Позиций пока нет.',
    'Assets →': 'Оборудование →', 'warranty': 'гарантия',
    'Every warranty is still in date.': 'Все гарантии ещё действуют.',
    'No assets yet.': 'Техники пока нет.',
    'Subscriptions →': 'Подписки →', 'per month': 'в месяц', 'renews': 'продление',
    'Nothing renews in the next 30 days.': 'В ближайшие 30 дней ничего не продлевается.',
    'No subscriptions yet.': 'Подписок пока нет.',
  },
  patterns: [
    [/^(\d+) in use of (\d+)$/, 'в работе: $1 из $2'],
  ],
});
