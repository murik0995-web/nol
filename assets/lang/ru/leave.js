/* Русские строки для apps/leave.html: календарь отсутствий, праздники, кто отсутствует сегодня, экспорт iCal. Ключи из этого файла перекрывают общий словарь — только на этой странице. */
NOL_LANG.add('ru', {
  exact: {
    'NOL Leave · free leave calendar and holiday tracker': 'NOL Отпуска · бесплатный календарь отсутствий и праздников',
    /* панель инструментов и вкладки */
    'Export iCal': 'Экспорт iCal',
    'Subscribe to this calendar in Google Calendar, Outlook or Apple Calendar': 'Подписаться на этот календарь в Google Календаре, Outlook или Apple Calendar',
    '+ Time off': '+ Отсутствие', '+ Holiday': '+ Праздник',
    'Calendar': 'Календарь', 'Holidays': 'Праздники',
    /* месяц */
    'Out today': 'Сегодня отсутствуют', 'holiday': 'праздник', 'back on': 'выйдет',
    'Previous month': 'Предыдущий месяц', 'Next month': 'Следующий месяц', 'This month': 'Текущий месяц',
    /* праздники */
    'Holiday': 'Праздник',
    'No public holidays yet': 'Праздников пока нет',
    'Add the days your company does not work, or import them as a CSV of name and date. They are yours to keep — NOL ships no country calendar.': 'Добавьте дни, когда компания не работает, или загрузите их CSV-файлом из названия и даты. Список ведёте вы — своего календаря по странам в NOL нет.',
    'Nothing booked yet': 'Пока ничего не запланировано',
    'Add a day off, import a Timetastic or Vacation Tracker export, or fill in your public holidays.': 'Добавьте выходной, загрузите выгрузку из Timetastic или Vacation Tracker, либо заполните список праздников.',
    /* формы */
    'Time off': 'Отсутствие', 'New time off': 'Новое отсутствие',
    'Public holiday': 'Праздник', 'New public holiday': 'Новый праздник',
    'From': 'С', 'To': 'По',
    /* уведомления */
    'Nothing to export yet.': 'Экспортировать пока нечего.',
    'Calendar exported. Open it in Google Calendar, Outlook or Apple Calendar.': 'Календарь выгружен. Откройте его в Google Календаре, Outlook или Apple Calendar.',
    /* список возможностей в пустом состоянии */
    'A month calendar of who is off, built from the same time-off requests as People': 'Календарь на месяц: кто отсутствует — из тех же заявок, что и в «Людях»',
    'Who is out today, above the month': 'Кто отсутствует сегодня — прямо над календарём',
    'Public holidays you keep yourself, marked on every calendar': 'Праздники, которые вы ведёте сами, отмечены в каждом месяце',
    'Approve or decline a request without leaving the calendar': 'Одобрить или отклонить заявку, не уходя из календаря',
    'Export the whole year as .ics and subscribe in Google Calendar, Outlook or Apple Calendar': 'Экспорт в .ics: подпишитесь в Google Календаре, Outlook или Apple Calendar',
    'Import from Timetastic, Vacation Tracker, LeaveBoard or Calamari CSV': 'Импорт из CSV Timetastic, Vacation Tracker, LeaveBoard или Calamari',
    'People come from People: one directory for the whole company': 'Сотрудники берутся из «Людей»: один справочник на всю компанию',
  },
  patterns: [
    [/^(\d+) away this month$/, 'в этом месяце отсутствуют: $1'],
    [/^(\d+) public holidays$/, 'праздников: $1'],
    [/^Imported (\d+) records\.$/, 'Импортировано записей: $1.'],
    [/^(.+): no person and start date columns found\.$/, '$1: не найдены колонки сотрудника и даты начала.'],
    [/^(.+): no holiday name and date columns found\.$/, '$1: не найдены колонки названия праздника и даты.'],
  ],
});
