// Русский для apps/factory.html — живой конвейер внутри NOL
NOL_LANG.add('ru', {
  exact: {
    'NOL Factory · the conveyor from the inside': 'NOL Завод · конвейер изнутри',
    'The conveyor that builds NOL, from the inside: agents at work, the board, QA and the journal.': 'Конвейер, который строит NOL, изнутри: агенты в работе, доска, тестирование и журнал.',
    'Public log': 'Публичный журнал',
    'Open the daemon': 'Открыть демон',

    /* 1 · живой конвейер */
    'Live': 'Живой конвейер',
    'Checking the conveyor…': 'Проверяем конвейер…',
    'The conveyor daemon runs on the owner’s Mac. It is not reachable from here, so this section stays quiet.': 'Демон конвейера работает на «маке» владельца. Отсюда он недоступен, поэтому этот раздел молчит.',
    'agents busy': 'агентов в работе',
    'spent today': 'потрачено сегодня',
    'conveyor': 'конвейер',
    'Running': 'Работает',
    'Paused': 'На паузе',
    'Now building': 'Строится сейчас',
    'Nothing is building right now.': 'Сейчас ничего не строится.',
    'Waiting in the queue': 'Ждут в очереди',
    'The queue is empty.': 'Очередь пуста.',
    'Last finished': 'Последние завершённые',
    'Nothing has shipped yet today.': 'Сегодня ещё ничего не выпущено.',

    /* 2 · доска */
    'Board': 'Доска',
    'Open in Tasks →': 'Открыть в Задачах →',
    'The board is empty': 'Доска пуста',
    'Cards in the project “Factory” of this workspace show up here. The conveyor writes their status, asks its questions and files QA reports as notes.': 'Здесь появляются карточки проекта «Factory» этого рабочего пространства. Конвейер пишет их статус, задаёт вопросы и оставляет отчёты тестировщика заметками.',
    'Queued': 'В очереди',
    'Building': 'Строится',
    'Asking': 'Спрашивает',
    'Review': 'На проверке',
    'Done': 'Готово',
    'Blocked': 'Заблокировано',
    'Untitled': 'Без названия',
    'Answer': 'Ответ',
    'Send answer': 'Отправить ответ',
    'The conveyor is waiting for an answer.': 'Конвейер ждёт ответа.',
    'Answer sent. The conveyor reads it as the owner’s answer.': 'Ответ отправлен. Конвейер прочтёт его как ответ владельца.',

    /* 3 · тестирование */
    'QA': 'Тестирование',
    'No QA reports yet. The tester agent uses the deployed product after every merge and writes what it found here.': 'Отчётов пока нет. Агент-тестировщик пользуется выпущенным продуктом после каждого слияния и пишет сюда, что нашёл.',

    /* 4 · журнал */
    'Journal': 'Журнал',
    'Full log →': 'Весь журнал →',
    'The journal is empty.': 'Журнал пуст.',
    'The journal is not available offline.': 'Журнал недоступен без сети.',

    /* возможности приложения в пустом состоянии */
    'The conveyor live: agents at work, spend against today’s budget': 'Конвейер вживую: агенты в работе, расходы против бюджета на день',
    'The Factory board: queued, building, asking, review, done, blocked': 'Доска завода: в очереди, строится, спрашивает, на проверке, готово, заблокировано',
    'Answer the conveyor’s question right on the card': 'Ответьте на вопрос конвейера прямо в карточке',
    'QA reports from the tester agent on every shipped card': 'Отчёты агента-тестировщика по каждой выпущенной карточке',
    'The public build journal, in your language': 'Публичный журнал сборок на вашем языке',
  },
  patterns: [
    [/^attempt (\d+)$/, 'попытка $1'],
  ],
});
