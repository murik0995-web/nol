/* Русские строки для apps/home.html: карточки остатков склада и подписок. */
NOL_LANG.add('ru', {
  exact: {
    'Retros': 'Ретро', 'Retros →': 'Ретро →', 'No retro cards yet.': 'Карточек ретро пока нет.',
    'Changelog': 'Изменения', 'Changelog →': 'Изменения →', 'No updates yet.': 'Обновлений пока нет.',
    /* карточка «Стендапы» */
    'Standups →': 'Стендапы →',
    'answered': 'ответил', 'blocked': 'заблокирован',
    'Nobody has written yet today.': 'Сегодня ещё никто не написал.',

    'Meetings →': 'Встречи →', 'meeting': 'встреча',
    'Nothing in the calendar ahead.': 'Впереди ничего не запланировано.',
    'No meetings yet.': 'Встреч пока нет.',
    'Stock': 'Склад', 'Inventory →': 'Склад →', 'low stock': 'мало',
    'Everything is above its reorder level.': 'Всё выше точки заказа.',
    'No items yet.': 'Позиций пока нет.',
    'Quotes →': 'Предложения →', 'quotes out': 'предложений в работе', 'No quotes yet.': 'Предложений пока нет.', 'Nothing waiting on a client.': 'Ничего не ждёт ответа клиента.',
    'sent': 'отправлено', 'draft': 'черновик', 'expired': 'просрочено',
    'Assets →': 'Оборудование →', 'warranty': 'гарантия',
    'Every warranty is still in date.': 'Все гарантии ещё действуют.',
    'No assets yet.': 'Техники пока нет.',
    'Subscriptions →': 'Подписки →', 'per month': 'в месяц', 'renews': 'продление',
    'Nothing renews in the next 30 days.': 'В ближайшие 30 дней ничего не продлевается.',
    'No subscriptions yet.': 'Подписок пока нет.',
    /* карточка договоров */
    'Contracts →': 'Договоры →',
    'No contracts yet.': 'Договоров пока нет.',
    'No notice deadline or renewal in the next 90 days.': 'В ближайшие 90 дней нет ни сроков уведомления, ни продлений.',
  },
  patterns: [
    [/^(\d+) expired$/, 'просрочено: $1'],
    [/^(\d+) in use of (\d+)$/, 'в работе: $1 из $2'],
  ],
});
