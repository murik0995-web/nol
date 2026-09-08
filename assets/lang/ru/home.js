/* Русские строки для apps/home.html: карточки остатков склада и подписок. */
NOL_LANG.add('ru', {
  exact: {
    /* карточка «Денежный поток» */
    'in twelve months': 'через двенадцать месяцев',
    'Over 12 months of cash': 'Денег больше чем на 12 месяцев',
    'Cash runs out': 'Деньги заканчиваются',
    'Next 12 months': 'Ближайшие 12 месяцев',
    'No cash flow plan yet.': 'Плана денежного потока пока нет.',
    'runway': 'взлётная полоса', 'money in': 'приход', 'money out': 'расход',
    'Retros': 'Ретро', 'Retros →': 'Ретро →', 'No retro cards yet.': 'Карточек ретро пока нет.',
    'Changelog': 'Изменения', 'Changelog →': 'Изменения →', 'No updates yet.': 'Обновлений пока нет.',
    'Metrics': 'Метрики', 'Dashboard →': 'Дашборд →', 'No metrics yet.': 'Метрик пока нет.',
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
    /* карточка «Ревью» */
    'Reviews →': 'Ревью →', 'No open review cycle.': 'Открытых циклов ревью нет.',
    'in progress': 'в работе', 'to write': 'написать',
    'Did not meet': 'Не соответствует', 'Partially met': 'Частично соответствует', 'Met expectations': 'Соответствует ожиданиям', 'Exceeded': 'Превышает ожидания', 'Outstanding': 'Выдающийся результат',
    /* карточка договоров */
    'Contracts →': 'Договоры →',
    'No contracts yet.': 'Договоров пока нет.',
    'Cap table →': 'Таблица долей →', 'shares fully diluted': 'акций полностью разводнённо', 'No shareholders yet.': 'Акционеров пока нет.', 'Option pool, unallocated': 'Опционный пул, нераспределённый',
    'No notice deadline or renewal in the next 90 days.': 'В ближайшие 90 дней нет ни сроков уведомления, ни продлений.',
    /* карточка статуса */
    'Status →': 'Статус →',
    'No open incidents.': 'Открытых инцидентов нет.',
    'No components yet.': 'Компонентов пока нет.',
    'All systems operational': 'Все системы работают', 'Maintenance in progress': 'Идёт обслуживание',
    'Incident in progress': 'Идёт инцидент', 'Degraded performance': 'Работает с замедлением',
    'Partial outage': 'Частичный сбой', 'Major outage': 'Крупный сбой',
    'Investigating': 'Разбираемся', 'Identified': 'Причина найдена', 'Monitoring': 'Наблюдаем', 'Resolved': 'Решено',
    /* карточка «Заказы поставщикам» */
    'Purchase orders →': 'Заказы поставщикам →', 'on order': 'в заказах',
    'Rooms': 'Переговорные', 'Rooms →': 'Переговорные →', 'Every room is free today.': 'Сегодня все переговорные свободны.', 'No rooms or desks yet.': 'Переговорных и рабочих мест пока нет.',
    'Nothing on order.': 'Ничего не заказано.', 'No purchase orders yet.': 'Заказов поставщикам пока нет.',
    'late': 'опаздывает', 'draft': 'черновик', 'pending': 'на согласовании', 'approved': 'согласован', 'sent': 'отправлен',
  },
  patterns: [
    [/^(\d+) expired$/, 'просрочено: $1'],
    [/^(\d+) in use of (\d+)$/, 'в работе: $1 из $2'],
    [/^(\d+) late$/, 'опаздывают: $1'],
    [/^(\d+) awaiting approval$/, 'на согласовании: $1'],
    [/^(\d+) of (\d+) written, due$/, 'написано: $1 из $2, срок'],
  ],
});
