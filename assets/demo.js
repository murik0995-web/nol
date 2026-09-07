/* Demo workspace: realistic sample data in the user's language, every record flagged demo:true so it can be removed in one click. Loaded lazily by NOL.demo.load(). */
(function () {
  const { store, lang } = NOL;
  const ru = lang() === 'ru';
  const D = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const T = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString(); };
  const pick = (arr, i) => arr[i % arr.length];
  const add = (c, o) => store.add(c, Object.assign({ demo: true }, o));
  function load() {
    const companies = (ru ? ['Ромашка', 'Северный ветер', 'ТехноСфера', 'Альфа Логистик', 'Медиа Пульс', 'Зелёный сад', 'Кофейня №1', 'СтройИнвест']
      : ['Acme Foods', 'North Wind', 'TechSphere', 'Alpha Logistics', 'Media Pulse', 'Green Garden', 'Coffee No. 1', 'BuildInvest']).map(name => add('companies', { name }));
    const first = ru ? ['Анна', 'Иван', 'Мария', 'Дмитрий', 'Елена', 'Сергей', 'Ольга', 'Алексей', 'Наталья', 'Павел', 'Ирина', 'Максим', 'Татьяна', 'Андрей'] : ['Anna', 'Ivan', 'Maria', 'Dmitry', 'Elena', 'Sergey', 'Olga', 'Alexey', 'Natalia', 'Pavel', 'Irina', 'Maxim', 'Tatiana', 'Andrey'];
    const last = ru ? ['Смирнова', 'Петров', 'Козлова', 'Волков', 'Соколова', 'Лебедев', 'Новикова', 'Морозов', 'Егорова', 'Орлов', 'Белова', 'Фёдоров', 'Кузнецова', 'Попов'] : ['Smirnova', 'Petrov', 'Kozlova', 'Volkov', 'Sokolova', 'Lebedev', 'Novikova', 'Morozov', 'Egorova', 'Orlov', 'Belova', 'Fedorov', 'Kuznetsova', 'Popov'];
    const titles = ru ? ['Директор', 'Закупки', 'Маркетинг', 'Финансовый директор', 'Операционный директор', 'Менеджер'] : ['CEO', 'Procurement', 'Marketing', 'CFO', 'COO', 'Manager'];
    const owners = ru ? ['Анна Смирнова', 'Иван Петров'] : ['Anna Smirnova', 'Ivan Petrov'];
    const contacts = first.map((f, i) => add('contacts', { name: `${f} ${last[i]}`, email: `${f.toLowerCase().replace(/[^a-z]/g, '') || 'user' + i}${i}@${['romashka.ru', 'nordwind.io', 'techsphere.com', 'alpha-log.ru', 'mediapulse.co', 'garden.ru', 'coffee1.ru', 'stroyinvest.ru'][i % 8]}`, title: pick(titles, i), phone: `+7 9${String(10 + i).padStart(2, '0')} ${String(100 + i * 7).padStart(3, '0')}-${String(10 + i).padStart(2, '0')}-${String(20 + i).padStart(2, '0')}`, owner: pick(owners, i), companyId: companies[i % 8].id }));
    // two duplicates, the way a second CSV import leaves them: one repeats an email, one repeats a phone typed differently
    contacts.push(add('contacts', { name: ru ? 'А. Смирнова' : 'A. Smirnova', email: contacts[0].email, phone: '', title: '', owner: '', companyId: companies[0].id }));
    contacts.push(add('contacts', { name: contacts[3].name, email: '', phone: (d => `8 (${d.slice(1, 4)}) ${d.slice(4, 7)} ${d.slice(7, 9)} ${d.slice(9)}`)(contacts[3].phone.replace(/\D/g, '')), title: contacts[3].title, owner: '', companyId: companies[3].id }));
    const stages = ['Lead', 'Qualified', 'Proposal', 'Won', 'Lost'];
    const dealNames = ru ? ['Внедрение CRM', 'Поставка кофе на квартал', 'Редизайн сайта', 'Логистика по Москве', 'Рекламная кампания', 'Озеленение офиса', 'Годовая поддержка', 'Ремонт склада', 'Обучение команды', 'Лицензии на год'] : ['CRM rollout', 'Quarterly coffee supply', 'Website redesign', 'Moscow logistics', 'Ad campaign', 'Office greenery', 'Annual support', 'Warehouse repair', 'Team training', 'Yearly licences'];
    const deals = dealNames.map((n, i) => { const st = pick([0, 0, 1, 1, 2, 2, 2, 3, 3, 4].map(k => stages[k]), i); return add('deals', { name: n, amount: [180000, 96000, 450000, 72000, 320000, 58000, 240000, 810000, 120000, 65000][i], stage: st, contact: contacts[i].name, close: ['Won', 'Lost'].includes(st) ? D(-9 - i * 11) : D(5 + i * 6), owner: pick(owners, i), companyId: companies[i % 8].id }); });
    // deals closed over the past year: the pipeline report reads win rate and closed-won by month from these
    (ru ? ['Пилот на складе', 'Печать каталога', 'Поставка воды в офис', 'Настройка телефонии', 'Аудит логистики', 'Съёмка для соцсетей'] : ['Warehouse pilot', 'Catalogue printing', 'Office water supply', 'Phone system setup', 'Logistics audit', 'Social media shoot'])
      .forEach((n, i) => add('deals', { name: n, amount: [140000, 62000, 38000, 210000, 95000, 74000][i], stage: i % 4 === 3 ? 'Lost' : 'Won', close: D(-24 - i * 47), contact: contacts[(i + 4) % 14].name, owner: pick(owners, i), companyId: companies[(i + 2) % 8].id }));
    const teams = ru ? ['Продажи', 'Поддержка', 'Разработка', 'Финансы'] : ['Sales', 'Support', 'Engineering', 'Finance'];
    const roles = ru ? ['Руководитель продаж', 'Специалист поддержки', 'Инженер', 'Бухгалтер', 'Менеджер по продажам', 'Специалист поддержки', 'Инженер', 'Финансовый аналитик'] : ['Head of Sales', 'Support specialist', 'Engineer', 'Accountant', 'Sales manager', 'Support specialist', 'Engineer', 'Financial analyst'];
    const pNames = ru ? ['Анна Смирнова', 'Иван Петров', 'Мария Козлова', 'Дмитрий Волков', 'Елена Соколова', 'Сергей Лебедев', 'Ольга Новикова', 'Алексей Морозов'] : ['Anna Smirnova', 'Ivan Petrov', 'Maria Kozlova', 'Dmitry Volkov', 'Elena Sokolova', 'Sergey Lebedev', 'Olga Novikova', 'Alexey Morozov'];
    const MGR = [-1, 0, 0, 0, 0, 1, 2, 3]; // who reports to whom: one person at the top, four leads under them, three of the leads with one report each
    const people = pNames.map((n, i) => add('people', { name: n, title: roles[i], team: teams[i % 4], email: n.toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, '.').replace(/^\.|\.$/g, '') + (i < 4 ? '' : i) + '@nol.team' || `p${i}@nol.team`, location: ru ? pick(['Москва', 'Санкт-Петербург', 'Казань', 'удалённо'], i) : pick(['Moscow', 'Berlin', 'Lisbon', 'remote'], i), start: D(-900 + i * 97), manager: MGR[i] < 0 ? '' : pNames[MGR[i]] }));
    [[2, 'Vacation', 0, 6, 'approved'], [5, 'Sick', -1, 1, 'approved'], [6, 'Remote', 3, 3, 'pending'], [3, 'Vacation', 12, 19, 'pending']].forEach(([pi, type, a, b, status]) => add('timeoff', { person: people[pi].name, type, from: D(a), to: D(b), status }));
    // days the company does not work: NOL ships no country calendar, these are sample records like every other demo row
    [[ru ? 'Корпоративный выходной' : 'Company day off', D(9)], [ru ? 'Офис закрыт' : 'Office closed', D(30)], [ru ? 'Новый год' : 'New Year\u2019s Day', `${new Date().getFullYear() + 1}-01-01`]].forEach(([name, date]) => add('holidays', { name, date }));
    const subjects = ru ? ['Не приходит счёт на почту', 'Как добавить второго пользователя?', 'Ошибка при импорте CSV', 'Просьба выставить закрывающие документы', 'Не открывается отчёт за август', 'Нужна выгрузка контактов', 'Дублируются контакты после импорта', 'Вопрос по договору', 'Хотим перейти на годовую оплату'] : ['Invoice not arriving by email', 'How do I add a second user?', 'Error importing CSV', 'Please send closing documents', 'August report does not open', 'Need a contacts export', 'Duplicate contacts after import', 'Contract question', 'We want annual billing'];
    subjects.forEach((s, i) => { const c = contacts[i + 2]; const created = T(-9 + i); const msgs = [{ from: 'requester', text: ru ? 'Здравствуйте! ' + s + '. Подскажите, пожалуйста, как быть.' : 'Hello! ' + s + '. Could you advise?', t: created }]; if (i % 3 !== 0) msgs.push({ from: 'agent', text: ru ? 'Добрый день! Посмотрели, разбираемся, вернёмся с ответом сегодня.' : 'Hi! We are looking into it and will get back today.', t: T(-9 + i + 0.2) }); if (i % 4 === 1) msgs.push({ from: 'note', text: ru ? 'Похоже на проблему с правами. Проверить настройки.' : 'Looks like a permissions issue. Check settings.', t: T(-9 + i + 0.3) }); add('tickets', { subject: s, requester: c.name, email: c.email, status: pick(['open', 'open', 'pending', 'solved', 'open', 'solved', 'pending', 'open', 'solved'], i), priority: pick(['urgent', 'normal', 'high', 'normal', 'low', 'normal', 'high', 'normal', 'normal'], i), assignee: pick([people[1].name, people[5].name, ''], i), messages: msgs, created, updated: T(-9 + i + 0.3) }); });
    (ru ? [['Приняли в работу', 'Здравствуйте, {{first}}!\n\nСпасибо за обращение «{{subject}}». Разбираемся, вернёмся с ответом сегодня.\n\n— {{agent}}', 'pending'],
      ['Нужны детали', 'Здравствуйте, {{first}}!\n\nПришлите, пожалуйста, скриншот и точное время, когда это произошло: так мы сможем воспроизвести проблему у себя.\n\n— {{agent}}', 'pending'],
      ['Готово, закрываем', 'Здравствуйте, {{first}}!\n\n«{{subject}}» — исправлено. Если повторится, ответьте в этом же письме, и мы вернём обращение в работу.\n\n— {{agent}}', 'solved'],
      ['Документы отправлены', 'Здравствуйте, {{first}}!\n\nЗакрывающие документы для компании {{company}} отправили на почту {{requester}}. Напишите, если чего-то не хватает.\n\n— {{agent}}', '']]
      : [['Taking a look', 'Hi {{first}},\n\nThanks for writing in about “{{subject}}”. We are looking into it and will come back to you today.\n\n— {{agent}}', 'pending'],
      ['Need more details', 'Hi {{first}},\n\nCould you send a screenshot and the exact time you saw this? That lets us reproduce it on our side.\n\n— {{agent}}', 'pending'],
      ['Fixed, closing', 'Hi {{first}},\n\n“{{subject}}” is fixed and live. Reply here if it comes back and we reopen this ticket.\n\n— {{agent}}', 'solved'],
      ['Documents sent', 'Hi {{first}},\n\nThe closing documents for {{company}} are on their way to {{requester}} by email. Tell us if anything is missing.\n\n— {{agent}}', '']]
    ).forEach(([name, body, status]) => add('macros', { name, body, status }));
    const pages = ru ? [['Онбординг новых сотрудников', 'Люди/Онбординг', '## Первая неделя\n\n1. Доступы: почта, NOL, календарь\n2. Знакомство с командой, 30 минут с каждым\n3. Первая задача из доски **Задачи**\n\n## Правила\n\n- Все договорённости фиксируем в Вики\n- В первый день прочитайте [[Ценности команды]]\n- Вопросы клиентов только через **Поддержку**\n- Отпуска по правилам из [[Регламент отпусков]]'], ['Регламент отпусков', 'Люди/Политики', '- 28 дней в год, можно делить\n- Заявка минимум за 2 недели\n- Согласует руководитель в NOL\n- Больничный отмечаем в день выхода\n\nТолько пришли? Начните с [[Онбординг новых сотрудников]].'], ['Как выставить счёт', 'Финансы/Процессы', '1. Откройте **Счета → + Счёт**\n2. Клиент из CRM, позиции, налог\n3. **Печать / PDF** и отправка клиенту\n4. После оплаты нажмите **Отметить оплаченным**\n\nКому звонить по печати и договорам: [[Подрядчики и контакты]].'], ['Ценности команды', '', '> Мы делаем меньше, но до конца.\n\n- Честность с клиентом важнее продажи\n- Пишем так, чтобы понял новый человек\n- Каждый может остановить релиз'], ['Подрядчики и контакты', 'Финансы/Подрядчики', '| Кто | Что | Контакт |\n|---|---|---|\n| Типография | визитки, буклеты | print@example.ru |\n| Юрист | договоры | law@example.ru |\n\nОбновляем раз в квартал. Как выставить им счёт: [[Как выставить счёт]].']]
      : [['New hire onboarding', 'People/Onboarding', '## First week\n\n1. Access: email, NOL, calendar\n2. Meet the team, 30 minutes each\n3. First task from the **Tasks** board\n\n## Rules\n\n- Every agreement goes into the Wiki\n- Read [[Team values]] on day one\n- Customer questions only through **Desk**\n- Time off follows [[Time-off policy]]'], ['Time-off policy', 'People/Policies', '- 28 days a year, can be split\n- Request at least 2 weeks ahead\n- Manager approves in NOL\n- Sick days are logged on return\n\nJust joined? Start with [[New hire onboarding]].'], ['How to issue an invoice', 'Finance/Processes', '1. Open **Invoices → + Invoice**\n2. Client from CRM, line items, tax\n3. **Print / PDF** and send\n4. After payment click **Mark paid**\n\nWho to call about print or contracts: [[Vendors and contacts]].'], ['Team values', '', '> We do less, but finish it.\n\n- Honesty with the customer beats the sale\n- Write so a new person understands\n- Anyone can stop a release'], ['Vendors and contacts', 'Finance/Vendors', '| Who | What | Contact |\n|---|---|---|\n| Print shop | cards, brochures | print@example.com |\n| Lawyer | contracts | law@example.com |\n\nReviewed quarterly. Billing them: [[How to issue an invoice]].']];
    pages.forEach(([title, folder, body]) => add('pages', { title, folder, body }));
    const tks = ru ? [['Подготовить КП для Ромашки', 'Doing', 0, 1, 'high', 'Продажи'], ['Обновить прайс на сайте', 'To do', 2, 3, 'medium', 'Сайт'], ['Ответить на просроченные обращения', 'To do', 1, -1, 'urgent', 'Поддержка'], ['Собрать отчёт по расходам за месяц', 'Doing', 3, 2, 'medium', 'Финансы'], ['Написать регламент возвратов', 'To do', 5, 6, 'low', 'Поддержка'], ['Настроить домен для почты', 'Done', 2, -3, 'high', 'Сайт'], ['Провести 1:1 с командой поддержки', 'To do', 0, 4, 'medium', 'Люди'], ['Согласовать договор со СтройИнвест', 'Doing', 0, -2, 'urgent', 'Продажи'], ['Перенести вики из Notion', 'Done', 6, -5, 'medium', 'Сайт'], ['Закрыть счета за август', 'To do', 3, 0, 'high', 'Финансы'], ['Нанять второго инженера', 'To do', 0, 20, 'medium', 'Люди'], ['Ретро по запуску', 'Done', 4, -8, 'low', 'Сайт']]
      : [['Prepare a proposal for Acme Foods', 'Doing', 0, 1, 'high', 'Sales'], ['Update prices on the website', 'To do', 2, 3, 'medium', 'Website'], ['Answer overdue tickets', 'To do', 1, -1, 'urgent', 'Support'], ['Monthly expenses report', 'Doing', 3, 2, 'medium', 'Finance'], ['Write the refund policy', 'To do', 5, 6, 'low', 'Support'], ['Set up the email domain', 'Done', 2, -3, 'high', 'Website'], ['1:1s with the support team', 'To do', 0, 4, 'medium', 'People'], ['Sign the BuildInvest contract', 'Doing', 0, -2, 'urgent', 'Sales'], ['Move the wiki from Notion', 'Done', 6, -5, 'medium', 'Website'], ['Close August invoices', 'To do', 3, 0, 'high', 'Finance'], ['Hire a second engineer', 'To do', 0, 20, 'medium', 'People'], ['Launch retro', 'Done', 4, -8, 'low', 'Website']];
    const steps = a => a.map(([text, done]) => ({ text, done: !!done }));
    const tkExtra = ru ? {
      0: { description: 'Ромашка просит **фиксированную цену** на первый квартал.\n\n## Что входит\n\n1. Объёмы прошлого года\n2. График поставок\n3. Скидка, согласованная с директором\n\n> Отправить до пятницы, решение принимают в понедельник.', subs: steps([['Запросить у финансов объёмы за год', 1], ['Согласовать скидку с Анной', 1], ['Написать КП', 0], ['Отправить клиенту', 0]]) },
      2: { subs: steps([['Отсортировать Поддержку по нарушениям SLA', 1], ['Ответить на три самых старых', 0], ['Сделать макрос на повторяющийся вопрос', 0]]) },
      3: { subs: steps([['Импортировать выписку по карте', 1], ['Отделить личные траты', 0], ['Отправить итоги финансовому директору', 0]]) },
    } : {
      0: { description: 'Acme wants a **fixed price** for the first quarter.\n\n## What goes in\n\n1. Volumes from last year\n2. Delivery schedule\n3. Discount agreed with the CEO\n\n> Send it before Friday, they decide on Monday.', subs: steps([['Ask finance for last year volumes', 1], ['Agree the discount with Anna', 1], ['Write the proposal', 0], ['Send it to the client', 0]]) },
      2: { subs: steps([['Sort Desk by SLA breach', 1], ['Answer the three oldest', 0], ['Write a macro for the repeated question', 0]]) },
      3: { subs: steps([['Import the card statement', 1], ['Split out the personal spend', 0], ['Send the totals to the CFO', 0]]) },
    };
    const taskRecs = tks.map(([title, status, pi, due, priority, project], i) => add('tasks', Object.assign({ title, status, assignee: people[pi].name, due: D(due), priority, project, description: '' }, tkExtra[i] || {})));
    const items = ru ? ['Консультация', 'Внедрение', 'Поддержка, месяц', 'Лицензии', 'Обучение'] : ['Consulting', 'Implementation', 'Support, month', 'Licences', 'Training'];
    const bank = ru ? 'ООО «Ваша компания»\nР/с 40702810000000000000\nБанк «Пример», БИК 000000000' : 'Your Company LLC\nAccount 0000 0000 0000 0000\nExample Bank, SWIFT/BIC EXAMPLE00';
    const seq = {}, invNo = iso => { const y = iso.slice(0, 4); seq[y] = (seq[y] || 0) + 1; return y + '-' + String(seq[y]).padStart(4, '0'); }; // numbering starts again every January
    const invs = [[0, 'paid', -75, -60, 2, 1], [1, 'paid', -48, -34, 1, 1], [2, 'paid', -30, -16, 3, 1], [3, 'sent', -20, -6, 2, 0], [6, 'partial', -12, 2, 2, 0.4], [4, 'sent', -5, 9, 1, 0], [5, 'draft', 0, 14, 2, 0]].map(([ci, status, issued, due, n, share], i) => {
      const lines = Array.from({ length: n }, (_, k) => ({ desc: items[(i + k) % 5], qty: 1 + k, rate: [45000, 120000, 30000, 18000, 25000][(i + k) % 5] }));
      const tot = lines.reduce((s, l) => s + l.qty * l.rate, 0) * 1.2;
      const paid = share ? [{ date: D(share === 1 ? due : issued + 4), amount: Math.round(tot * share), method: pick(['Bank transfer', 'Card'], i), ref: '' }] : [];
      return add('invoices', { number: invNo(D(issued)), clientId: companies[ci].id, issued: D(issued), due: D(due), status, taxRate: 20, from: ru ? 'ООО «Ваша компания»\nМосква, ул. Примерная, 1\nbilling@company.ru' : 'Your Company LLC\n1 Example St\nbilling@company.com', billto: companies[ci].name, bank, notes: ru ? 'Оплата в течение 14 дней.' : 'Payment within 14 days.', items: lines, payments: paid, recur: i === 5 ? 'monthly' : '', recurNext: i === 5 ? D(25) : '' });
    });
    const party = ru ? 'ООО «Ваша компания»\nМосква, ул. Примерная, 1\nlegal@company.ru' : 'Your Company LLC\n1 Example St\nlegal@company.com';
    const tplBodies = ru ? [
      ['Договор оказания услуг', '## 1. Стороны\n\nНастоящий договор заключён {{today}} между {{us}} («Исполнитель») и {{company}} («Заказчик») в лице {{contact}}, {{role}}.\n\n## 2. Предмет\n\nИсполнитель выполняет работы, согласованные с Заказчиком письменно. Контакт по договору: {{email}}, {{phone}}.\n\n## 3. Срок\n\nДоговор действует с {{start}} по {{end}} и продлевается на тот же срок, если ни одна из сторон не уведомит другую за {{notice}} дней до окончания.\n\n## 4. Цена\n\n{{value}} за срок действия. Счета выставляются ежемесячно, оплата в течение 14 дней.\n\n## 5. Конфиденциальность\n\nСтороны не передают третьим лицам непубличную информацию друг друга.\n\n## 6. Расторжение\n\nЛюбая сторона вправе расторгнуть договор при существенном нарушении, не устранённом в течение 30 дней после письменного уведомления.'],
      ['Соглашение о неразглашении', '## 1. Стороны\n\n{{us}} и {{company}} обмениваются непубличной информацией для оценки совместной работы.\n\n## 2. Обязательства\n\nСтороны хранят полученную информацию в тайне и используют её только для этой цели. Ответственное лицо: {{contact}} ({{email}}).\n\n## 3. Срок\n\nОбязательства действуют с {{start}} и сохраняются 3 года после {{end}}.'],
    ] : [
      ['Services agreement', '## 1. Parties\n\nThis agreement is made on {{today}} between {{us}} (“the Provider”) and {{company}} (“the Client”), represented by {{contact}}, {{role}}.\n\n## 2. Services\n\nThe Provider performs the work agreed with the Client in writing. Contact for this agreement: {{email}}, {{phone}}.\n\n## 3. Term\n\nIt starts {{start}} and runs until {{end}}, then renews for the same term unless either side gives notice {{notice}} days before that date.\n\n## 4. Fees\n\n{{value}} for the term, invoiced monthly, payable within 14 days.\n\n## 5. Confidentiality\n\nNeither side shares the other side’s non-public information with anyone outside this agreement.\n\n## 6. Termination\n\nEither side may terminate for a material breach the other has not fixed within 30 days of written notice.'],
      ['Mutual NDA', '## 1. Parties\n\n{{us}} and {{company}} exchange non-public information to evaluate working together.\n\n## 2. Obligations\n\nBoth sides keep what they receive confidential and use it only for that purpose. Responsible person: {{contact}} ({{email}}).\n\n## 3. Term\n\nIt starts {{start}} and the obligations survive 3 years after {{end}}.'],
    ];
    tplBodies.forEach(([name, body]) => add('templates', { name, body }));
    const contractTitles = ru ? ['Договор оказания услуг', 'Договор поставки', 'Соглашение о неразглашении', 'Аренда склада', 'Договор консультирования'] : ['Master services agreement', 'Supply agreement', 'Mutual NDA', 'Warehouse lease', 'Consulting agreement'];
    // one contract sits inside its notice window and one has already run out: that is what the reminders list is for
    [[0, 0, 'signed', -320, 45, 60, true, 480000, 0], [1, 1, 'signed', -180, 120, 30, false, 960000, 0], [2, 2, 'sent', -5, 300, 30, false, 0, 1], [7, 3, 'signed', -400, -30, 60, false, 720000, 0], [4, 4, 'draft', 0, 0, 30, false, 240000, 0]]
      .forEach(([ci, ti, status, start, end, noticeDays, autoRenew, value, tpl], i) => add('contracts', {
        title: contractTitles[ti], counterpartyId: companies[ci].id, contactId: contacts[ci].id, status,
        start: D(start), end: end ? D(end) : '', noticeDays, autoRenew, value, owner: pick(owners, i), party,
        body: tplBodies[tpl][1], notes: '',
      }));
    const cats = ['Software', 'Travel', 'Meals', 'Office', 'Marketing', 'Equipment'];
    const merchants = ru ? ['Яндекс 360', 'Аэрофлот', 'Кофемания', 'Комус', 'VK Реклама', 'DNS', 'Ситимобил', 'Ozon', 'Google Workspace', 'Метро Кэш энд Керри'] : ['Google Workspace', 'Aeroflot', 'Coffee House', 'Office Depot', 'Meta Ads', 'Apple', 'Uber', 'Amazon', 'Notion', 'Costco'];
    const expenseRecs = []; for (let i = 0; i < 16; i++) expenseRecs.push(add('expenses', { date: D(-2 - i * 5), merchant: pick(merchants, i), category: pick(cats, i), amount: [2900, 18400, 1250, 4600, 25000, 89900, 640, 3200, 5400, 7800, 2900, 12500, 1650, 4100, 30000, 990][i] * (i === 13 ? -1 : 1), method: pick(['Company card', 'Personal card', 'Bank transfer', 'Cash'], i), spender: people[i % 8].name, notes: '' }));
    const tlProjects = ru ? ['Продажи', 'Сайт', 'Поддержка', 'Финансы'] : ['Sales', 'Website', 'Support', 'Finance'];
    const tlNotes = ru ? ['Звонки клиентам', 'Вёрстка главной', 'Разбор обращений', 'Сверка счетов', 'Подготовка КП', 'Правки по отзывам'] : ['Client calls', 'Homepage layout', 'Ticket triage', 'Invoice reconciliation', 'Proposal draft', 'Review fixes'];
    const note = (coll, ref, text, ai, d) => add('notes', { coll, ref, text, author: people[ai].name, created: T(d) });
    (ru ? [['deals', deals[0].id, 'Клиент просит перенести демо на четверг. @Иван Петров, подтвердишь время?', 0, -3], ['deals', deals[0].id, 'Подтвердил. Демо в четверг в 15:00, ссылка в календаре.', 1, -2], ['contacts', contacts[0].id, 'Предпочитает почту, звонки только по договорённости.', 0, -6], ['tasks', taskRecs[0].id, 'Черновик КП готов, жду цифры от @Мария Козлова.', 0, -1], ['invoices', invs[3].id, 'Отправлен повторно, бухгалтерия обещала оплату на этой неделе.', 3, -1]]
      : [['deals', deals[0].id, 'Client asked to move the demo to Thursday. @Ivan Petrov, can you confirm the time?', 0, -3], ['deals', deals[0].id, 'Confirmed. Demo on Thursday 3pm, link is in the calendar.', 1, -2], ['contacts', contacts[0].id, 'Prefers email; calls only when agreed in advance.', 0, -6], ['tasks', taskRecs[0].id, 'Proposal draft is ready, waiting for numbers from @Maria Kozlova.', 0, -1], ['invoices', invs[3].id, 'Re-sent the invoice, accounting promised payment this week.', 3, -1]]
    ).forEach(a => note(...a));
    const dataUrl = (type, text) => { const u = new TextEncoder().encode(text); let bin = ''; for (const b of u) bin += String.fromCharCode(b); return { type, size: u.length, data: 'data:' + type + ';base64,' + btoa(bin) }; };
    const receipt = (title, line1, line2) => dataUrl('image/svg+xml', `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="200" viewBox="0 0 360 200"><rect width="360" height="200" fill="#fff"/><text x="24" y="48" font-family="monospace" font-size="20" fill="#111">${title}</text><text x="24" y="96" font-family="monospace" font-size="16" fill="#444">${line1}</text><text x="24" y="132" font-family="monospace" font-size="16" fill="#444">${line2}</text></svg>`);
    const file = (coll, ref, name, f) => add('files', { coll, ref, name, type: f.type, size: f.size, data: f.data });
    file('expenses', expenseRecs[0].id, ru ? 'Чек.svg' : 'Receipt.svg', receipt(ru ? 'ЧЕК' : 'RECEIPT', pick(merchants, 0), D(-2)));
    file('expenses', expenseRecs[4].id, ru ? 'Счёт поставщика.svg' : 'Supplier invoice.svg', receipt(ru ? 'СЧЁТ' : 'INVOICE', pick(merchants, 4), D(-22)));
    file('deals', deals[0].id, ru ? 'Коммерческое предложение.txt' : 'Proposal.txt', dataUrl('text/plain', ru ? 'Коммерческое предложение\n\n1. Внедрение — 6 недель\n2. Обучение команды — 2 дня\n3. Поддержка — 12 месяцев' : 'Proposal\n\n1. Rollout — 6 weeks\n2. Team training — 2 days\n3. Support — 12 months'));
    file('invoices', invs[0].id, ru ? 'Акт выполненных работ.svg' : 'Signed delivery note.svg', receipt(ru ? 'АКТ' : 'DELIVERY NOTE', invs[0].number, D(-60)));
    file('tasks', taskRecs[0].id, ru ? 'Черновик КП.txt' : 'Proposal draft.txt', dataUrl('text/plain', ru ? 'Черновик. Ждём цифры от финансов.' : 'Draft. Waiting for numbers from finance.'));
    const qNow = NOL.quarterOf(D(0)), qPrev = NOL.quarterOf(new Date(Date.parse(NOL.quarterRange(NOL.quarterOf(D(0)))[0]) - 864e5).toISOString());
    const okrs = ru ? [
      ['Вырасти выручку и удержать клиентов', qNow, 0, 'Компания живёт на повторных продажах, а не на разовых сделках.', [['Закрыть сделок на 6 млн ₽', 0, 62, 2], ['Довести конверсию из заявки в сделку до 30%', 1, 45, 1], ['Продлить 9 из 10 договоров', 3, 80, 1]]],
      ['Сделать поддержку быстрой', qNow, 1, 'Первый ответ за час — то, за что нас рекомендуют.', [['Первый ответ быстрее часа в 90% обращений', 1, 74, 2], ['Собрать 20 готовых ответов в базе', 4, 35, 1]]],
      ['Собрать команду, которая тянет рост', qNow, 0, 'Нанимаем медленно, вводим в дело быстро.', [['Нанять двух инженеров', 0, 50, 1], ['Онбординг новичка за 5 дней', 2, 20, 1]]],
      ['Запустить новый сайт', qPrev, 2, 'Старый сайт не рассказывал, чем мы занимаемся.', [['Перенести все страницы из Notion', 6, 100, 1], ['Сократить время загрузки до 1 секунды', 2, 100, 1]]],
    ] : [
      ['Grow revenue and keep the clients we have', qNow, 0, 'The company lives on renewals, not one-off deals.', [['Close $120k of new business', 0, 62, 2], ['Take lead-to-deal conversion to 30%', 1, 45, 1], ['Renew 9 contracts out of 10', 3, 80, 1]]],
      ['Make support fast', qNow, 1, 'A first reply within the hour is what people recommend us for.', [['First reply under an hour on 90% of tickets', 1, 74, 2], ['Write 20 canned replies', 4, 35, 1]]],
      ['Build the team that carries the growth', qNow, 0, 'Hire slowly, onboard quickly.', [['Hire two engineers', 0, 50, 1], ['Onboard a new joiner in 5 days', 2, 20, 1]]],
      ['Ship the new website', qPrev, 2, 'The old site never said what we actually do.', [['Move every page out of Notion', 6, 100, 1], ['Get the page load under one second', 2, 100, 1]]],
    ];
    const ciNotes = ru ? ['Две сделки в финальной стадии, ждём подписи.', 'Застряли: клиент просит скидку, эскалирую.', 'Идём по плану, ничего не мешает.', 'Пересобрали процесс, стало быстрее.'] : ['Two deals at signature stage.', 'Stuck: the client wants a discount, escalating.', 'On plan, nothing in the way.', 'Reworked the process, it got faster.'];
    okrs.forEach(([title, quarter, oi, description, krs], i) => {
      const obj = add('goals', { title, quarter, owner: people[oi].name, description, parent: '' });
      krs.forEach(([krTitle, ki, progress, weight], j) => add('goals', {
        title: krTitle, parent: obj.id, owner: people[ki].name, weight, progress,
        checkins: [{ date: D(-14), progress: Math.round(progress * 0.6), note: pick(ciNotes, i + j), author: '' }, { date: D(-3), progress, note: pick(ciNotes, i + j + 2), author: '' }],
      }));
    });
    // hiring: four openings and the people applying to them, spread across the stage board
    const jobRows = ru ? [['Менеджер по продажам', 0, 'Full-time'], ['Инженер поддержки', 1, 'Full-time'], ['Фронтенд-разработчик', 2, 'Full-time'], ['Бухгалтер на полставки', 3, 'Part-time']]
      : [['Sales manager', 0, 'Full-time'], ['Support engineer', 1, 'Full-time'], ['Frontend developer', 2, 'Full-time'], ['Part-time accountant', 3, 'Part-time']];
    const jobRecs = jobRows.map(([title, ti, type], i) => add('jobs', { title, dept: teams[ti], location: ru ? pick(['Москва', 'удалённо'], i) : pick(['Moscow', 'remote'], i), type, status: i === 3 ? 'On hold' : 'Open', owner: people[i].name, opened: D(-40 + i * 9), description: ru ? 'Ищем человека в команду «' + teams[ti] + '». Подробности обсуждаем на первом созвоне.' : 'We are looking for someone to join the ' + teams[ti] + ' team. Details on the first call.' }));
    const sources = ru ? ['Рекомендация', 'LinkedIn', 'Работный сайт', 'Страница вакансий', 'Агентство', 'Мероприятие'] : ['Referral', 'LinkedIn', 'Job board', 'Careers page', 'Agency', 'Event'];
    const candStages = ['Applied', 'Applied', 'Screen', 'Screen', 'Interview', 'Interview', 'Offer', 'Hired', 'Rejected', 'Applied', 'Screen', 'Interview', 'Rejected', 'Applied'];
    const candRecs = candStages.map((stage, i) => add('candidates', {
      name: `${first[(i + 3) % 14]} ${last[(i + 7) % 14]}`, email: `applicant${i + 1}@mail.example`,
      phone: `+7 9${String(30 + i).padStart(2, '0')} ${String(200 + i * 5).padStart(3, '0')}-${String(30 + i).padStart(2, '0')}-${String(40 + i).padStart(2, '0')}`,
      jobId: jobRecs[i % 4].id, stage, source: pick(sources, i), owner: people[i % 2].name, applied: D(-30 + i * 2),
      location: ru ? pick(['Москва', 'Санкт-Петербург', 'удалённо'], i) : pick(['Moscow', 'Berlin', 'remote'], i), link: '',
    }));
    (ru ? [[6, 'Оффер отправлен, ждём ответа до пятницы.', 0, -2], [4, 'Сильное техническое интервью. @Иван Петров, назначишь финальную встречу?', 1, -3], [8, 'Не готовы к переезду, вернуться к кандидату через полгода.', 0, -5]]
      : [[6, 'Offer sent, waiting for an answer by Friday.', 0, -2], [4, 'Strong technical interview. @Ivan Petrov, can you book the final round?', 1, -3], [8, 'Not ready to relocate; worth another look in six months.', 0, -5]]
    ).forEach(([ci, text, ai, d]) => note('candidates', candRecs[ci].id, text, ai, d));
    file('candidates', candRecs[6].id, ru ? 'Резюме.txt' : 'Resume.txt', dataUrl('text/plain', ru ? 'Резюме\n\n5 лет в продажах B2B\nПоследнее место: ТехноСфера' : 'Resume\n\n5 years in B2B sales\nLast role: TechSphere'));
    const invNames = ru ? ['Кофе арабика, 1 кг', 'Стаканы бумажные 250 мл', 'Бумага А4, 500 листов', 'Зарядка для ноутбука 65 Вт', 'Скотч упаковочный, 50 м', 'Коробка картонная M', 'Тонер для принтера 12A', 'Фильтры для кофе, 100 шт', 'Ручки шариковые, 50 шт', 'Вода питьевая, 19 л']
      : ['Arabica beans, 1 kg', 'Paper cups, 250 ml', 'A4 paper, 500 sheets', 'Laptop charger 65W', 'Packing tape, 50 m', 'Cardboard box M', 'Printer toner 12A', 'Coffee filters, 100 pcs', 'Ballpoint pens, 50 pcs', 'Drinking water, 19 l'];
    const invSkus = ['COF-ARA-1K', 'CUP-250', 'PAP-A4-500', 'CHG-65W', 'TAP-50M', 'BOX-M', 'TON-12A', 'FLT-100', 'PEN-50', 'WTR-19L'];
    const invCats = ru ? ['Кухня', 'Упаковка', 'Офис', 'Техника'] : ['Kitchen', 'Packaging', 'Office', 'Equipment'];
    const invLocs = ru ? ['Главный склад', 'Кладовая в офисе'] : ['Main warehouse', 'Office storage'];
    // qty at or below reorder = low on stock: three of them are, so the low-stock filter and the Home card have something to show
    const invRows = [[3, 24, 8, 1450], [180, 60, 0, 12], [24, 10, 2, 480], [2, 3, 3, 3900], [14, 6, 1, 210], [60, 40, 1, 95], [1, 2, 3, 5400], [18, 12, 0, 320], [7, 4, 2, 640], [15, 6, 0, 290]];
    const invCatIx = [0, 0, 2, 3, 1, 1, 2, 0, 2, 0]; // кухня / упаковка / офис / техника — по смыслу позиции
    const invItems = invNames.map((name, i) => { const [qty, reorder, li, cost] = invRows[i]; return add('items', { sku: invSkus[i], name, category: invCats[invCatIx[i]], location: invLocs[li % 2], qty, reorder, cost, supplier: companies[(i + 3) % 8].name, notes: '' }); });
    const mvNotes = ru ? ['Поставка от поставщика', 'Выдано в офис', 'Инвентаризация', 'Продажа клиенту', 'Возврат на склад', 'Списание, брак']
      : ['Delivery from supplier', 'Issued to the office', 'Stocktake', 'Sold to a client', 'Returned to the warehouse', 'Written off, damaged'];
    [[0, 'in', 24, 0, -26], [0, 'out', -12, 1, -18], [0, 'out', -9, 1, -6], [1, 'in', 200, 4, -21], [1, 'out', -20, 1, -4], [2, 'in', 30, 0, -30],
     [2, 'out', -6, 5, -11], [3, 'out', -1, 2, -8], [4, 'in', 20, 0, -16], [4, 'out', -6, 1, -3], [6, 'out', -2, 2, -13], [6, 'adjust', -1, 4, -2],
     [8, 'in', 12, 0, -24], [8, 'out', -5, 1, -7], [9, 'out', -3, 1, -1]]
      .forEach(([ii, type, delta, pi, d], k) => add('movements', { itemId: invItems[ii].id, type, delta, date: D(d), person: people[pi].name, note: pick(mvNotes, type === 'in' ? 0 : type === 'adjust' ? 2 : k % 2 ? 1 : 3), created: T(d) }));
    note('items', invItems[0].id, ru ? 'Поставщик поднял цену на 8%. @Иван Петров, посмотрим альтернативы?' : 'The supplier raised the price by 8%. @Ivan Petrov, shall we look at alternatives?', 0, -4);
    file('items', invItems[2].id, ru ? 'Накладная.svg' : 'Delivery note.svg', receipt(ru ? 'НАКЛАДНАЯ' : 'DELIVERY NOTE', invSkus[2], D(-30)));
    // подписки: то, за что компания ещё платит; три продления попадают в ближайшие 30 дней, одна уже отменена
    const subNames = ['Google Workspace', 'Zendesk Suite', 'HubSpot Sales Hub', 'Notion', 'Trello', 'BambooHR', 'Toggl Track', 'Expensify', 'Figma', 'Sortly']; // названия сервисов не переводятся
    const subMeta = [['', ''], ['zendesk', 'desk'], ['hubspot', 'crm'], ['notion', 'wiki'], ['trello', 'tasks'], ['bamboohr', 'people'], ['toggl-track', 'timesheets'], ['expensify', 'expenses'], ['', ''], ['sortly', 'inventory']];
    // [стоимость за период, цикл, мест, через сколько дней продление, кто отвечает, статус]
    const subRows = [[7200, 'monthly', 8, 0, 3, 'active'], [26700, 'monthly', 3, 9, 1, 'active'], [324000, 'yearly', 4, 23, 0, 'active'],
      [2400, 'monthly', 8, 41, 6, 'active'], [1500, 'monthly', 8, 55, 2, 'active'], [11800, 'monthly', 8, 74, 4, 'active'],
      [3600, 'monthly', 5, 96, 1, 'active'], [4200, 'monthly', 6, 118, 3, 'active'], [13500, 'monthly', 3, 137, 5, 'active'],
      [4900, 'monthly', 2, -12, 7, 'cancelled']];
    const subs = subNames.map((tool, i) => { const [cost, cycle, seats, dd, pi, status] = subRows[i]; const [slug, cat] = subMeta[i]; return add('subscriptions', { tool, owner: people[pi].name, cost, cycle, seats, renewal: D(dd), status, slug, cat, notes: '' }); });
    note('subscriptions', subs[2].id, ru ? 'Годовой счёт приходит в марте. @Анна Смирнова, пересматриваем число мест?' : 'The annual invoice lands in March. @Anna Smirnova, do we review the seat count?', 1, -5);
    // прайс-лист и коммерческие предложения: из чего собирается КП, что клиент принял, что просрочено
    const plRows = ru ? [['Консультация', 'час', 6000], ['Внедрение', 'этап', 120000], ['Поддержка', 'месяц', 30000], ['Обучение команды', 'день', 45000], ['Лицензия', 'место в год', 18000]]
      : [['Consulting', 'hour', 6000], ['Implementation', 'stage', 120000], ['Support', 'month', 30000], ['Team training', 'day', 45000], ['Licence', 'seat per year', 18000]];
    plRows.forEach(([name, unit, rate]) => add('pricelist', { name, unit, rate }));
    const qSeq = {}, qNo = iso => { const y = iso.slice(0, 4); qSeq[y] = (qSeq[y] || 0) + 1; return 'Q-' + y + '-' + String(qSeq[y]).padStart(4, '0'); };
    // [компания, сделка, статус, выставлено, действует до, скидка, строк] — третье предложение просрочено: отправлено, а срок уже прошёл
    const qRows = [[0, 0, 'accepted', -40, -10, '10%', 3], [2, 2, 'sent', -12, 18, '', 2], [4, 4, 'sent', -33, -3, '15000', 2], [5, 5, 'declined', -60, -30, '', 1], [1, 1, 'draft', -2, 28, '5%', 2]];
    const quoteRecs = qRows.map(([ci, di, status, iss, val, discount, n], i) => {
      const lines = Array.from({ length: n }, (_, k) => { const [name, , rate] = plRows[(i + k) % plRows.length]; return { desc: name, qty: 1 + k, rate }; });
      return add('quotes', { number: qNo(D(iss)), title: deals[di].name, clientId: companies[ci].id, dealId: deals[di].id, issued: D(iss), valid: D(val), status, discount, taxRate: 20,
        from: ru ? 'ООО «Ваша компания»\nМосква, ул. Примерная, 1\nsales@company.ru' : 'Your Company LLC\n1 Example St\nsales@company.com', billto: companies[ci].name,
        notes: ru ? 'Цены действуют до конца срока предложения. Срок работ — 6 недель с даты подписания.' : 'Prices hold until the quote expires. Delivery within 6 weeks of signature.', items: lines });
    });
    note('quotes', quoteRecs[1].id, ru ? 'Клиент просит разбить оплату на два этапа. @Анна Смирнова, согласуем?' : 'The client wants to split the payment in two. @Anna Smirnova, do we agree?', 1, -4);
    note('quotes', quoteRecs[2].id, ru ? 'Срок предложения вышел, надо перевыставить с новыми ценами.' : 'The quote has expired; it needs reissuing at the new prices.', 0, -2);
    // техника компании: у кого что на руках, что лежит на складе, у двух гарантия вот-вот кончится, у одной уже кончилась
    const asNames = ru ? ['MacBook Pro 14"', 'MacBook Air 13"', 'ThinkPad T14', 'Dell Latitude 5450', 'iPhone 15', 'iPhone 14', 'Монитор Dell U2723QE', 'Монитор LG 27UP850', 'iPad Air', 'Принтер HP LaserJet M428', 'Ноутбук Acer TravelMate', 'Роутер MikroTik hEX']
      : ['MacBook Pro 14"', 'MacBook Air 13"', 'ThinkPad T14', 'Dell Latitude 5450', 'iPhone 15', 'iPhone 14', 'Dell U2723QE monitor', 'LG 27UP850 monitor', 'iPad Air', 'HP LaserJet M428 printer', 'Acer TravelMate laptop', 'MikroTik hEX router'];
    const asCats = ru ? ['Ноутбук', 'Телефон', 'Монитор', 'Планшет', 'Сеть и печать'] : ['Laptop', 'Phone', 'Monitor', 'Tablet', 'Network and print'];
    const asCatIx = [0, 0, 0, 0, 1, 1, 2, 2, 3, 4, 0, 4];
    const asLocs = ru ? ['Офис, Москва', 'Офис, Санкт-Петербург', 'Кладовая в офисе'] : ['Office, Moscow', 'Office, Berlin', 'Office storage'];
    // [индекс человека (-1 = ни у кого), статус, дней назад куплено, через сколько дней кончается гарантия, цена, место]
    const asRows = [[0, 'in use', -430, 300, 249000, 0], [1, 'in use', -300, 430, 159000, 0], [2, 'in use', -700, 30, 132000, 1],
      [3, 'in use', -560, 170, 118000, 1], [0, 'in use', -240, 490, 94000, 0], [4, 'in use', -820, -90, 71000, 1],
      [1, 'in use', -390, 340, 62000, 0], [-1, 'in stock', -150, 580, 48000, 2], [5, 'in use', -180, 550, 74000, 0],
      [-1, 'in use', -960, -230, 39000, 0], [-1, 'repair', -1100, -370, 58000, 2], [-1, 'retired', -1500, -770, 12000, 2]];
    const asAssets = asNames.map((name, i) => { const [pi, status, bought, warr, cost, li] = asRows[i]; return add('assets', { name, tag: 'NOL-' + String(1001 + i), serial: ['C02', 'FVF', 'PF1', 'JH8', 'DNP', 'DXQ', 'CN0', '207', 'GG7', 'VNB', 'NXV', 'HGX'][i] + String(74210 + i * 137) + ['K', 'L', 'M', 'N', 'P', 'R', 'S', 'T', 'V', 'W', 'X', 'Y'][i], category: asCats[asCatIx[i]], status, person: pi < 0 ? '' : people[pi].name, location: asLocs[li], purchased: D(bought), warranty: D(warr), cost, supplier: companies[(i + 2) % 8].name, notes: '' }); });
    note('assets', asAssets[2].id, ru ? 'Гарантия кончается через месяц, батарея держит хуже. @Иван Петров, меняем или продлеваем?' : 'The warranty runs out in a month and the battery is fading. @Ivan Petrov, replace or extend?', 1, -3);
    note('assets', asAssets[10].id, ru ? 'Отдали в сервис: не работает клавиатура. Ждём до конца недели.' : 'Sent to the service centre: the keyboard is dead. Expected back by the end of the week.', 0, -6);
    // стендапы: один ежедневный чек-ин, участники — команда разработки и поддержки; за три рабочих дня, у двоих блокеры
    const stQuestions = ru ? ['Что вы сделали вчера?', 'Что вы сделаете сегодня?', 'Что вам мешает?'] : ['What did you do yesterday?', 'What will you do today?', 'Anything blocking you?'];
    const stPeople = [people[0], people[1], people[2], people[4], people[5]].map(p => p.name);
    const standup = add('standups', { name: ru ? 'Ежедневный стендап' : 'Daily standup', questions: stQuestions, participants: stPeople });
    const stAnswers = ru ? [
      [['Согласовала КП для Ромашки и созвонилась со СтройИнвестом.', 'Соберу цифры по кварталу и отправлю КП.', 'Нет'],
       ['Разобрал очередь обращений, осталось три старых.', 'Отвечу на просроченные и напишу макрос.', 'Нет'],
       ['Правил вёрстку главной.', 'Доделаю мобильную версию.', 'Жду доступы к серверу от подрядчика'],
       ['Сверила счета за август.', 'Закрою оставшиеся четыре.', 'Ничего'],
       ['Смотрел ошибку импорта CSV у клиента.', 'Воспроизведу и почищу парсер.', 'Нет']],
      [['Отправила КП, ждём решения в понедельник.', 'Проведу 1:1 с поддержкой.', 'Нет'],
       ['Ответил на все просроченные обращения.', 'Напишу регламент возвратов.', 'Нет'],
       ['Мобильная версия готова.', 'Начну переезд вики из Notion.', 'Всё ок'],
       ['Закрыла счета за август.', 'Соберу отчёт по расходам.', 'Нет'],
       ['Починил парсер CSV.', 'Проверю на выгрузках клиентов.', 'Нужен доступ к тестовому стенду, второй день жду']],
      [['Провела 1:1 со всей поддержкой.', 'Займусь договором со СтройИнвест.', 'Нет'],
       ['Написал черновик регламента возвратов.', 'Отдам на вычитку Анне.', 'Нет'],
       ['Перенёс половину страниц вики.', 'Закончу перенос и проверю ссылки.', 'Половина картинок не выгрузилась из Notion, нужен доступ к их API'],
       ['Отчёт по расходам готов.', 'Отправлю финансовому директору.', 'Нет'],
       ['Проверил парсер на трёх выгрузках.', 'Выкачу исправление.', 'Нет']]]
      : [
      [['Agreed the proposal for Acme Foods and called BuildInvest.', 'Pull the quarterly numbers and send the proposal.', 'No'],
       ['Worked through the ticket queue, three old ones left.', 'Answer the overdue ones and write a macro.', 'No'],
       ['Fixed the homepage layout.', 'Finish the mobile version.', 'Waiting on server access from the contractor'],
       ['Reconciled the August invoices.', 'Close the remaining four.', 'Nothing'],
       ['Looked into the customer CSV import error.', 'Reproduce it and clean up the parser.', 'No']],
      [['Sent the proposal, they decide on Monday.', 'Run 1:1s with support.', 'No'],
       ['Answered every overdue ticket.', 'Write the refund policy.', 'No'],
       ['Mobile version is done.', 'Start moving the wiki off Notion.', 'All good'],
       ['Closed the August invoices.', 'Put the expenses report together.', 'No'],
       ['Fixed the CSV parser.', 'Test it against customer exports.', 'I need access to the staging box, second day waiting']],
      [['Ran 1:1s with the whole support team.', 'Move on to the BuildInvest contract.', 'No'],
       ['Drafted the refund policy.', 'Hand it to Anna to review.', 'No'],
       ['Moved half the wiki pages across.', 'Finish the move and check the links.', 'Half the images did not come out of Notion, I need access to their API'],
       ['The expenses report is ready.', 'Send it to the CFO.', 'No'],
       ['Tested the parser on three exports.', 'Ship the fix.', 'No']]];
    // сегодня написали не все: последний участник ещё не отвечал, так что виден блок «ещё не написали»
    const stRecs = [];
    [-2, -1, 0].forEach((d, k) => stAnswers[k].forEach((answers, pi) => {
      if (d === 0 && pi === 4) return;
      stRecs.push(add('checkins', { standupId: standup.id, person: stPeople[pi], date: D(d), answers, blocked: !!NOL.standupBlocker(stQuestions, answers) })); // «нет» и «всё ок» блокером не считаются, а «жду доступы» — считается
    }));
    note('checkins', stRecs[7].id, ru ? 'Доступы к стенду выдам сегодня. @Иван Петров, продублируй заявку на подрядчика.' : 'I will hand over the staging access today. @Ivan Petrov, please chase the contractor request.', 0, -1);
    // ретро: одно живое ретро спринта с голосами и поручениями, одно прошлое — в архиве
    const rtCols = ru ? ['Что прошло хорошо', 'Что улучшить', 'Что сделать'] : ['Went well', 'To improve', 'Action items'];
    const retro = add('retros', { name: ru ? 'Ретро спринта 24' : 'Sprint 24 retro', date: D(-1), columns: rtCols, archived: false });
    const rtOld = add('retros', { name: ru ? 'Ретро спринта 23' : 'Sprint 23 retro', date: D(-15), columns: rtCols, archived: true });
    const rtCards = ru ? [
      [0, 'Импорт CSV наконец заработал на выгрузках клиентов.', 4, 4],
      [0, 'Поддержка закрыла всю просроченную очередь за два дня.', 1, 3],
      [0, 'Переезд вики из Notion идёт быстрее, чем мы думали.', 2, 1],
      [1, 'Доступы к тестовому стенду ждали два дня, задача стояла.', 4, 5],
      [1, 'Половина картинок не выгрузилась из Notion, никто не проверил заранее.', 2, 3],
      [1, 'Ретро начали на двадцать минут позже, часть людей ушла.', 3, 1],
      [2, 'Выдавать доступы к стенду в первый день спринта', 0, 4],
      [2, 'Проверять выгрузку картинок до начала переноса страниц', 2, 2],
    ] : [
      [0, 'The CSV import finally works on real customer exports.', 4, 4],
      [0, 'Support cleared the whole overdue queue in two days.', 1, 3],
      [0, 'Moving the wiki off Notion is going faster than we thought.', 2, 1],
      [1, 'Staging access took two days to arrive and the work sat still.', 4, 5],
      [1, 'Half the images did not come out of Notion and nobody checked first.', 2, 3],
      [1, 'We started the retro twenty minutes late and lost half the room.', 3, 1],
      [2, 'Hand out staging access on the first day of the sprint', 0, 4],
      [2, 'Check the image export before moving any pages', 2, 2],
    ];
    const rtRecs = rtCards.map(([ci, text, pi, v]) => add('retrocards', { retroId: retro.id, col: rtCols[ci], text, author: people[pi].name, votes: v, taskId: '' }));
    for (const c of rtRecs) if (c.col === rtCols[2]) store.update('retrocards', c.id, { taskId: add('tasks', { title: c.text, assignee: c.author, due: D(3), status: 'To do', priority: '', project: retro.name, description: c.text }).id }); // поручение ретро — настоящая задача в «Задачах»
    (ru ? [[0, 'Релиз выкатили в срок, откатов не было.', 1, 3], [1, 'Оценки задач опять разъехались вдвое.', 0, 4]]
        : [[0, 'The release shipped on time with no rollbacks.', 1, 3], [1, 'Our estimates were out by a factor of two again.', 0, 4]])
      .forEach(([ci, text, pi, v]) => add('retrocards', { retroId: rtOld.id, col: rtCols[ci], text, author: people[pi].name, votes: v, taskId: '' }));
    note('retrocards', rtRecs[3].id, ru ? 'Заявку на доступы теперь заводим в первый день. @Иван Петров, проследишь?' : 'We now raise the access request on day one. @Ivan Petrov, will you watch it?', 0, -1);
    // изменения: обновления продукта в Markdown с версиями и тегами, последняя запись — черновик
    const clTags = ru ? ['Добавлено', 'Улучшено', 'Исправлено'] : ['Added', 'Improved', 'Fixed'];
    (ru ? [
      ['Импорт CSV из любой CRM', 'v1.4.0', -2, [0, 1], 'Колонки сопоставляются сами: имя, почта, телефон и компания находятся, как бы их ни назвали в выгрузке.\n\n- Выгрузки HubSpot, Pipedrive и Salesforce\n- Даты читаются в том порядке, в каком их написали\n- Дубликаты видно сразу после импорта', 'published'],
      ['Оргструктура и календарь отпусков', 'v1.3.0', -9, [0], 'Оргструктура рисуется по полю «Руководитель» в «Людях» — отдельный справочник вести не нужно.\n\nКалендарь отпусков читает те же заявки, что и «Люди»: одна запись, два вида.', 'published'],
      ['Быстрее поиск по всему пространству', 'v1.2.1', -17, [1], 'Поиск по Cmd/Ctrl+K больше не подвисает на больших базах.\n\n> На 20 000 записей ответ стал быстрее примерно втрое.', 'published'],
      ['Счёт больше не терял частичные оплаты', 'v1.2.0', -28, [2], 'Частичная оплата, внесённая в двух вкладках сразу, могла пропасть при синхронизации. Теперь выигрывает более поздняя запись, и остаток к оплате сходится.', 'published'],
      ['Тёмная и светлая тема', '', 3, [0], 'Готовим переключатель темы. Черновик: в опубликованную страницу изменений он не попадёт, пока вы не смените статус.', 'draft'],
    ] : [
      ['CSV import from any CRM', 'v1.4.0', -2, [0, 1], 'Columns are matched for you: name, email, phone and company are found whatever the export called them.\n\n- HubSpot, Pipedrive and Salesforce exports\n- Dates are read in the order they were written\n- Duplicates show up right after the import', 'published'],
      ['Org chart and a leave calendar', 'v1.3.0', -9, [0], 'The org chart is drawn from the Manager field in People — there is no second directory to keep.\n\nThe leave calendar reads the very time-off requests People already keeps: one record, two views.', 'published'],
      ['Faster workspace search', 'v1.2.1', -17, [1], 'Cmd/Ctrl+K no longer stalls on a large workspace.\n\n> On 20,000 records the answer comes back about three times faster.', 'published'],
      ['Invoices no longer lost a partial payment', 'v1.2.0', -28, [2], 'A partial payment entered in two tabs at once could disappear on the next sync. The later record wins now, and the balance due adds up.', 'published'],
      ['Light and dark theme', '', 3, [0], 'A theme switch is on the way. This one is a draft: it stays out of the published page until you change its status.', 'draft'],
    ]).forEach(([title, version, d, tg, body, status]) => add('releases', { title, version, date: D(d), tags: tg.map(i => clTags[i]), body, status }));
    // встречи: повестка, заметки в Markdown, решения и поручения; каждое поручение — настоящая задача в «Задачах»
    const meets = ru ? [
      ['Планёрка по продажам', -7, '10:00', [0, 1, 4], '1. Сделки на подписи\n2. Просроченные счета\n3. Что мешает', '**Ромашка** просит фиксированную цену на квартал.\n\n- Северный ветер переносит демо на четверг\n- По СтройИнвест ждём юриста', ['Даём Ромашке скидку 7% при оплате за квартал вперёд', 'Демо для Северного ветра переносим на четверг'], [['Отправить КП Ромашке', 0, 2, 0], ['Позвонить в СтройИнвест по договору', 1, 1, 1]]],
      ['1:1 с поддержкой', -3, '15:30', [1, 5], 'Нагрузка, SLA, готовые ответы', 'Пик обращений по понедельникам. Нужен ещё один готовый ответ про импорт CSV.', ['Первый ответ держим в пределах часа, даже в понедельник'], [['Написать готовый ответ про импорт CSV', 5, 4, 0]]],
      ['Квартальное планирование', -14, '11:00', [0, 1, 2, 3], '1. Итоги квартала\n2. Цели на следующий\n3. Найм', 'Выручка выше плана на 8%. Поддержка — узкое место.', ['Нанимаем второго инженера в этом квартале', 'Цель по первому ответу — час, а не два'], [['Открыть вакансию инженера', 2, 6, 1]]],
      ['Разбор недели', 0, '17:00', [0, 1, 2, 4, 5], '1. Что сделали\n2. Что застряло\n3. Планы на неделю', '', [], []],
      ['Демо для Северного ветра', 4, '14:00', [0, 1], '1. Показать импорт из CRM\n2. Ответить про синхронизацию\n3. Сроки внедрения', '', [], []],
    ] : [
      ['Sales stand-up', -7, '10:00', [0, 1, 4], '1. Deals at signature\n2. Overdue invoices\n3. Anything blocking', '**Acme Foods** wants a fixed price for the quarter.\n\n- North Wind is moving the demo to Thursday\n- BuildInvest is waiting on their lawyer', ['Acme gets 7% off if they pay a quarter up front', 'The North Wind demo moves to Thursday'], [['Send the proposal to Acme Foods', 0, 2, 0], ['Call BuildInvest about the contract', 1, 1, 1]]],
      ['1:1 with support', -3, '15:30', [1, 5], 'Load, SLA, canned replies', 'Mondays are the peak. We need one more canned reply about CSV imports.', ['First reply stays inside the hour, Mondays included'], [['Write a canned reply about CSV import', 5, 4, 0]]],
      ['Quarterly planning', -14, '11:00', [0, 1, 2, 3], '1. How the quarter went\n2. Goals for the next one\n3. Hiring', 'Revenue came in 8% above plan. Support is the bottleneck.', ['We hire a second engineer this quarter', 'First reply target is one hour, not two'], [['Open the engineer job', 2, 6, 1]]],
      ['Week review', 0, '17:00', [0, 1, 2, 4, 5], '1. What shipped\n2. What is stuck\n3. Next week', '', [], []],
      ['North Wind demo', 4, '14:00', [0, 1], '1. Show the CRM import\n2. Answer the sync question\n3. Rollout dates', '', [], []],
    ];
    const meetRecs = meets.map(([title, d, time, ppl, agenda, notes, decisions, actions]) => add('meetings', {
      title, date: D(d), time, attendees: ppl.map(i => people[i].name), agenda, notes, decisions,
      actions: actions.map(([text, pi, due, done]) => ({ text, assignee: people[pi].name, due: D(due), taskId: add('tasks', { title: text, assignee: people[pi].name, due: D(due), status: done ? 'Done' : 'To do', priority: '', project: 'Meetings', description: '' }).id })),
    }));
    note('meetings', meetRecs[0].id, ru ? 'Скидку согласовали. @Иван Петров, добавишь условие в договор?' : 'The discount is agreed. @Ivan Petrov, can you put the clause in the contract?', 0, -6);
    for (let i = 0; i < 22; i++) add('timelogs', { person: people[i % 5].name, project: pick(tlProjects, i), note: pick(tlNotes, i), date: D(-(i % 12)), minutes: [90, 150, 45, 210, 60, 120, 30, 180, 75, 240, 105, 135][i % 12] });
  }
  window.NOL_DEMO = { load };
})();
