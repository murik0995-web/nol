/* Русские строки для apps/rooms.html: переговорные и рабочие места, день по часам, брони по людям, пересечения не сохраняются. */
NOL_LANG.add('ru', {
  exact: {
    /* заголовок страницы и шапка */
    'NOL Rooms · free room and desk booking': 'NOL Переговорные · бесплатное бронирование комнат и мест',
    'Rooms': 'Переговорные', 'Rooms →': 'Переговорные →', 'Room': 'Переговорная', 'Room or desk': 'Комната или место',
    'Booking': 'Бронь', 'Bookings': 'Брони',
    '+ Room': '+ Комната', '+ Booking': '+ Бронь',
    'New booking': 'Новая бронь', 'Edit booking': 'Изменить бронь',
    'New resource': 'Новый ресурс', 'Edit resource': 'Изменить ресурс',
    /* пустое состояние */
    'No rooms or desks yet': 'Переговорных и рабочих мест пока нет',
    'Add a meeting room or a hot desk, or import a CSV from Robin, Skedda, Joan or OfficeRnD.': 'Добавьте переговорную или свободное рабочее место либо загрузите CSV из Robin, Skedda, Joan или OfficeRnD.',
    'No rooms or desks yet.': 'Переговорных и рабочих мест пока нет.',
    'Every room is free today.': 'Сегодня все переговорные свободны.',
    'Nothing matches. Clear the search.': 'Ничего не найдено. Очистите поиск.',
    'Nothing booked from today on.': 'С сегодняшнего дня броней нет.',
    'Nobody named': 'Без имени',
    /* режимы и навигация по дню */
    'Day': 'День', 'By person': 'По людям', 'Resources': 'Ресурсы',
    'Today': 'Сегодня', 'today': 'сегодня', 'Now': 'Сейчас',
    'Previous day': 'Предыдущий день', 'Next day': 'Следующий день',
    'Click an empty hour to book it': 'Нажмите на свободный час, чтобы забронировать',
    /* таблица ресурсов */
    'Resource': 'Ресурс', 'Kind': 'Тип', 'Capacity': 'Вместимость', 'Where': 'Где',
    'Equipment': 'Оборудование', 'Booked today': 'Броней сегодня',
    'room': 'комната', 'desk': 'место', 'rooms': 'комнаты', 'desks': 'места',
    /* форма брони */
    'Date': 'Дата', 'From': 'С', 'To': 'До', 'Booked by': 'Кто забронировал', 'Purpose': 'Тема',
    'Name': 'Название', 'Seats': 'Мест', 'Notes': 'Заметки',
    'Second floor': 'Второй этаж', 'Screen, whiteboard, video': 'Экран, доска, видеосвязь',
    'Weekly sales review': 'Планёрка отдела продаж', 'Anna Smirnova': 'Анна Смирнова', 'Meeting room A': 'Переговорная А',
    'Save': 'Сохранить', 'Cancel': 'Отмена', 'Delete': 'Удалить',
    /* конфликты: бронь поверх чужой не сохраняется */
    'Already taken': 'Уже занято',
    'The end has to come after the start.': 'Конец должен быть позже начала.',
    'Booking saved.': 'Бронь сохранена.',
    'Resource saved.': 'Ресурс сохранён.',
    'Add a room or a desk first.': 'Сначала добавьте комнату или рабочее место.',
    'One booking skipped: the resource was already taken.': 'Пропущена одна бронь — ресурс уже был занят.',
    'Delete this booking? It goes to Trash and can be restored.': 'Удалить эту бронь? Она попадёт в Корзину, откуда её можно вернуть.',
    'Delete this resource? Its bookings stay in Trash with it.': 'Удалить этот ресурс? Его брони уйдут в Корзину вместе с ним.',
    /* импорт и экспорт */
    'Import CSV': 'Загрузить CSV', 'Export CSV': 'Выгрузить CSV', 'Search…': 'Поиск…',
    /* список возможностей в пустом состоянии */
    'Meeting rooms and desks on one day, hour by hour': 'Переговорные и рабочие места на один день, по часам',
    'A booking can never take a room somebody already has: the clash is refused before it is saved': 'Бронь не может занять комнату, которая уже занята: пересечение отклоняется до сохранения',
    'Click an empty hour on a room to book it there and then': 'Нажмите на свободный час у комнаты, чтобы забронировать её прямо там',
    'Every booking by person: what each of you has today and what is coming': 'Все брони по людям: что у каждого сегодня и что впереди',
    'Capacity, floor and equipment on every room, so a booking for ten never lands in a room for four': 'Вместимость, этаж и оборудование у каждой комнаты, чтобы встреча на десятерых не попала в комнату на четверых',
    'People come from People: one directory for the whole company': 'Люди берутся из «Людей»: один справочник на всю компанию',
    'Import from Robin, Skedda, Joan or OfficeRnD CSV': 'Импорт из CSV Robin, Skedda, Joan или OfficeRnD',
    'Timestamped notes with @mentions on every booking': 'Заметки с датой и @упоминаниями на каждой брони',
    /* карточка на главной и в списке приложений */
    'Meeting rooms and desks, a day view, no double bookings': 'Переговорные и рабочие места, день по часам, без двойных броней',
  },
  patterns: [
    [/^(\d+) resources$/, 'ресурсов: $1'],
    [/^(\d+) booked today$/, 'сегодня забронировано: $1'],
    [/^(\d+) in conflict$/, 'с пересечением: $1'],
    [/^Imported (\d+) bookings and (\d+) resources\.$/, 'Загружено броней: $1, ресурсов: $2.'],
    [/^(\d+) bookings skipped: the resource was already taken\.$/, 'Пропущено броней: $1 — ресурс уже был занят.'],
    [/^(.+): no room, desk or resource column found\.$/, '$1: колонка с комнатой, местом или ресурсом не найдена.'],
  ],
});
