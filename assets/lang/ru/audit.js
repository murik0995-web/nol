/* Russian strings for apps/audit.html. Collection labels shared with trash-history (Company, Contact, Time entry, …) already live in assets/lang/ru.js; only the ones new to this app are here. */
NOL_LANG.add('ru', { exact: {
    'Audit log': 'Журнал действий',
    'All types': 'Все типы', 'All people': 'Все',
    'No audit entries yet': 'Записей пока нет',
    'Every add, edit and delete across NOL lands here automatically: who made it, when, and which fields changed.': 'Каждое добавление, изменение и удаление в NOL попадает сюда само: кто сделал, когда и какие поля изменились.',
    'Nothing matches these filters.': 'Под фильтры ничего не подходит.',
    'When': 'Когда', 'Who': 'Кто', 'Action': 'Действие', 'Type': 'Тип', 'Card': 'Карточка', 'Fields changed': 'Изменённые поля',
    'Open →': 'Открыть →',
    'Every add, edit and delete across every app, who made it and which fields changed': 'Каждое добавление, изменение и удаление в любом приложении: кто сделал и какие поля изменились',
    'Links straight to the record it happened on': 'Ссылки прямо на карточку, где это произошло',
    'Filter by app or by who made the change': 'Фильтр по приложению и по тому, кто внёс изменение',
    'Values never leave the record itself, only field names are logged': 'Значения остаются только в самой записи, в журнал попадают лишь имена полей',
    'Asset': 'Оборудование', 'Component': 'Компонент', 'Incident': 'Инцидент', 'Update': 'Обновление',
    'Round': 'Раунд', 'Cycle': 'Цикл', 'Sticky note': 'Стикер', 'Holiday': 'Праздник', 'Onboarding plan': 'План онбординга',
  }, patterns: [
    [/^(\d+) entries$/, 'записей: $1'],
    [/^(\d+) of (\d+) entries$/, '$1 из $2 записей'],
  ] });
