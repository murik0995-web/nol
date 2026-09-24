// Русский для apps/factory.html — живой конвейер внутри NOL
// noop: e2e wave-1 marker
NOL_LANG.add('ru', {
  exact: {
    'NOL Factory · the conveyor from the inside': 'NOL Завод · конвейер изнутри',
    'The conveyor that builds NOL, from the inside: agents at work, the board, QA and the journal.': 'Конвейер, который строит NOL, изнутри: агенты в работе, доска, тестирование и журнал.',
    'Public log': 'Публичный журнал',
    'Open the daemon': 'Открыть демон',

    /* 0 · шапка: квота и автоматика */
    'Quota unavailable': 'Квота недоступна',
    'Automation': 'Автоматика',
    'review': 'ревью',
    'merge': 'мерж',
    'conflicts': 'конфликты',
    'tester': 'тестировщик',

    /* 1 · живой конвейер */
    'Live': 'Живой конвейер',
    'Checking the conveyor…': 'Проверяем конвейер…',
    'The conveyor daemon runs on the owner’s Mac. It is not reachable from here, so this section stays quiet.': 'Демон конвейера работает на «маке» владельца. Отсюда он недоступен, поэтому этот раздел молчит.',
    'The live conveyor is visible only on the Mac where it runs.': 'Живой конвейер виден только на том «маке», где он работает.',
    'Open the live Factory on this Mac': 'Открыть живой Завод на этом Mac',
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
    'Agent console': 'Пульт агента',
    'Hide console': 'Свернуть пульт',

    /* 5.5 · чат с агентом */
    'Write to the agent. Enter sends, Shift+Enter adds a line': 'Написать агенту. Enter отправит, Shift+Enter добавит строку',
    'Sent. The agent gets it at its next step': 'Отправлено. Агент получит на следующем шаге',
    'Could not reach the conveyor.': 'Не удалось связаться с конвейером.',
    'You can write once the agent pauses or finishes.': 'Написать можно, когда агент остановится или закончит.',

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
    'Build now': 'В работу',
    'The conveyor picks it up within a minute.': 'Конвейер возьмёт в течение минуты.',
    'Answer': 'Ответ',
    'Send answer': 'Отправить ответ',
    'The conveyor is waiting for an answer.': 'Конвейер ждёт ответа.',
    'Answer sent. The conveyor reads it as the owner’s answer.': 'Ответ отправлен. Конвейер прочтёт его как ответ владельца.',
    'Model': 'Модель',
    'Effort': 'Усилие',
    'permissions: as task agents': 'права: как у агентов задач',

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

    /* эпики (ZAVOD-TZ 5.2) */
    'Epics': 'Эпики',
    'New epic': 'Новая эпика',
    'Accept waves automatically': 'Принимать волны автоматически',
    'Plan and start': 'Спланировать и начать',
    'Actions need the daemon on this Mac': 'Действия доступны там, где работает демон',
    'Run your own factory on this machine: see factory/daemon/README.md': 'Запустите свой завод на этой машине: см. factory/daemon/README.md',
    'No epics yet. An epic is a goal split into waves of tasks; main receives it only when it is whole.': 'Эпик пока нет. Эпика это цель, разбитая на волны задач; в мастер она попадает только целиком.',
    'In progress': 'В работе',
    'Finalizing': 'Финализация',
    'Failed': 'Провал',
    'Finalize': 'Финализировать',
    'Cancel epic': 'Отменить эпику',
    'wave is not closed yet': 'волна ещё не закрыта',
    'Wave accepted.': 'Волна принята.',
    'Finalizing the epic.': 'Эпика финализируется.',
    'Epic cancelled.': 'Эпика отменена.',
  },
  pages: { 'factory.html': { 'Title': 'Заголовок' } }, // the shared 'Title' key means job title (Должность); here it is the epic's title field
  patterns: [
    [/^attempt (\d+)$/, 'попытка $1'],
    [/^(\d+) of (\d+) tasks closed · (\d+)%$/, '$1 из $2 задач закрыто · $3%'],
    [/^Merged waves: (\d+) of (\d+) · wave W(\d+) running \((\d+) of (\d+)\)\. Merge to main opens when the whole epic is assembled\.$/, 'Слито волн: $1 из $2 · идёт волна W$3 ($4 из $5). Мерж в мастер откроется, когда эпика будет собрана.'],
    [/^Accept W(\d+)$/, 'Принять W$1'],
    [/^Cancel epic (\S+)\? Its queued tasks stop; the branch stays\.$/, 'Отменить эпику $1? Её задачи в очереди остановятся; ветка останется.'],
    [/^Epic (\S+): (\d+) waves, (\d+) tasks$/, 'Эпика $1: волн $2, задач $3'],
  ],
});
