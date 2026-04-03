export interface Phase {
  id: string;
  name: string;
  subtitle: string;
  startDate: string;
  endDate: string;
  color: string;
  weeks: Week[];
}

export interface Week {
  number: number;
  startDate: string;
  endDate: string;
  tasks: WeekTask[];
}

export interface WeekTask {
  title: string;
  section: string; // letter reference
  done: boolean;
  critical?: boolean;
}

export interface Milestone {
  date: string;
  title: string;
  fallback: string;
  critical: boolean;
  done: boolean;
}

export const milestones: Milestone[] = [
  { date: '2026-04-20', title: 'Тендер на сайт запущен', fallback: 'Сайт не успеет к 1 июня', critical: true, done: false },
  { date: '2026-04-25', title: 'Тендер на трейлер запущен', fallback: 'Трейлер сорван', critical: true, done: false },
  { date: '2026-05-01', title: 'Дизайн мерча у Давида', fallback: 'Производство не успеет', critical: false, done: false },
  { date: '2026-05-04', title: 'Подрядчик на сайт выбран', fallback: 'Сократить до 10 предложений', critical: true, done: false },
  { date: '2026-05-11', title: 'Подрядчик на трейлер выбран', fallback: 'Нарезка из архивов групп', critical: false, done: false },
  { date: '2026-05-25', title: 'Съёмки трейлера завершены', fallback: 'Женя снимает на iPhone', critical: false, done: false },
  { date: '2026-06-01', title: 'Сайт запущен', fallback: 'Лендинг на TicketsCloud', critical: true, done: false },
  { date: '2026-06-15', title: '10+ кругляшей амбассадоров', fallback: 'Принять всех от 1k подписчиков', critical: false, done: false },
  { date: '2026-07-01', title: '500+ билетов продано', fallback: 'Аварийный режим если <300', critical: true, done: false },
];

export const phases: Phase[] = [
  {
    id: 'awareness',
    name: 'УЗНАВАЕМОСТЬ',
    subtitle: 'Осведомлённость — Pull',
    startDate: '2026-04-07',
    endDate: '2026-05-04',
    color: '#6366F1',
    weeks: [
      {
        number: 1, startDate: '2026-04-07', endDate: '2026-04-13',
        tasks: [
          { title: 'Запустить тендер на сайт (RFP → 30 подрядчиков)', section: 'Сайт', done: false, critical: true },
          { title: 'Согласовать AJTBD-профиль аудитории', section: 'Стратегия', done: true },
          { title: 'Первые питчи инфопартнёрам', section: 'Партнёры', done: false },
          { title: 'Публикация: анонс лайнапа ВК', section: 'Контент', done: false },
        ],
      },
      {
        number: 2, startDate: '2026-04-14', endDate: '2026-04-20',
        tasks: [
          { title: 'Собрать предложения по сайту (звонки)', section: 'Сайт', done: false },
          { title: 'Отправить 10 питчей амбассадорам', section: 'Амбассадоры', done: false },
          { title: 'Публикация: Группа недели — Master', section: 'Контент', done: false },
          { title: 'Публикация: Extreme Опрос #1', section: 'Контент', done: false },
        ],
      },
      {
        number: 3, startDate: '2026-04-21', endDate: '2026-04-27',
        tasks: [
          { title: 'Финализировать 15 предложений по сайту', section: 'Сайт', done: false },
          { title: 'Запустить тендер на трейлер', section: 'Трейлер', done: false, critical: true },
          { title: 'Начать посевы ТГ (3-5 каналов)', section: 'Блогеры', done: false },
          { title: 'Публикация: скейт-зона анонс', section: 'Контент', done: false },
        ],
      },
      {
        number: 4, startDate: '2026-04-28', endDate: '2026-05-04',
        tasks: [
          { title: 'Созвоны с топ-3 подрядчиками сайта', section: 'Сайт', done: false, critical: true },
          { title: 'Собрать предложения по трейлеру', section: 'Трейлер', done: false },
          { title: 'Follow-up инфопартнёрам', section: 'Партнёры', done: false },
          { title: 'Публикация: Fast Food серия', section: 'Контент', done: false },
        ],
      },
    ],
  },
  {
    id: 'consideration',
    name: 'ПРОГРЕВ',
    subtitle: 'Снятие барьеров',
    startDate: '2026-05-05',
    endDate: '2026-06-01',
    color: '#EAB308',
    weeks: [
      {
        number: 5, startDate: '2026-05-05', endDate: '2026-05-11',
        tasks: [
          { title: 'Подрядчик сайта выбран → onboarding', section: 'Сайт', done: false, critical: true },
          { title: 'Подрядчик трейлера выбран', section: 'Трейлер', done: false },
          { title: 'Заказать первую партию мерча', section: 'Мерч', done: false },
          { title: 'Публикация: мерч тизер', section: 'Контент', done: false },
        ],
      },
      {
        number: 6, startDate: '2026-05-12', endDate: '2026-05-18',
        tasks: [
          { title: 'Контроль дизайн-макета сайта', section: 'Сайт', done: false },
          { title: 'Подготовка к съёмкам трейлера', section: 'Трейлер', done: false },
          { title: 'Первый розыгрыш билетов', section: 'Г', done: false },
          { title: 'Публикация: партнёр Ernie Ball', section: 'Контент', done: false },
        ],
      },
      {
        number: 7, startDate: '2026-05-19', endDate: '2026-05-25',
        tasks: [
          { title: 'Контроль вёрстки сайта', section: 'Сайт', done: false },
          { title: 'Съёмочный день трейлера', section: 'Трейлер', done: false, critical: true },
          { title: 'Раздать флаеры (20 точек)', section: 'Блогеры', done: false },
          { title: 'Публикация: скетч Оли', section: 'Контент', done: false },
        ],
      },
      {
        number: 8, startDate: '2026-05-26', endDate: '2026-06-01',
        tasks: [
          { title: 'Приёмка сайта → ЗАПУСК', section: 'Сайт', done: false, critical: true },
          { title: 'Мерч в производство', section: 'Мерч', done: false },
          { title: 'Публикация трейлера', section: 'Трейлер', done: false, critical: true },
          { title: 'Первые реакции блогеров', section: 'Блогеры', done: false },
        ],
      },
    ],
  },
  {
    id: 'urgency',
    name: 'АЖИОТАЖ',
    subtitle: 'Дефицит и срочность',
    startDate: '2026-06-02',
    endDate: '2026-06-29',
    color: '#F97316',
    weeks: [
      {
        number: 9, startDate: '2026-06-02', endDate: '2026-06-08',
        tasks: [
          { title: 'Кругляши амбассадоров — волна 1 (3-5)', section: 'Амбассадоры', done: false },
          { title: 'Региональные посевы (Рязань, Калуга, НН)', section: 'Блогеры', done: false },
          { title: 'Фото мерча для контента', section: 'Мерч', done: false },
          { title: 'Посевы ТГ — волна 2 (10+ каналов)', section: 'Блогеры', done: false },
        ],
      },
      {
        number: 10, startDate: '2026-06-09', endDate: '2026-06-15',
        tasks: [
          { title: 'Кругляши — волна 2 (ещё 3-5)', section: 'Амбассадоры', done: false },
          { title: 'Контент «мы другие» (vs Скрежет, неявно)', section: 'Контент', done: false },
          { title: 'Второй розыгрыш билетов', section: 'Г', done: false },
          { title: '10+ кругляшей к 15 июня', section: 'Амбассадоры', done: false, critical: true },
        ],
      },
      {
        number: 11, startDate: '2026-06-16', endDate: '2026-06-22',
        tasks: [
          { title: 'Мониторинг Скрежета (фест в конце июня)', section: 'Б', done: false },
          { title: 'Контент «мы другие» — усиление', section: 'Контент', done: false },
          { title: 'Добивающие посевы в ТГ', section: 'Блогеры', done: false },
        ],
      },
      {
        number: 12, startDate: '2026-06-23', endDate: '2026-06-29',
        tasks: [
          { title: 'Полная интенсивность на всех каналах', section: 'Контент', done: false, critical: true },
          { title: 'Ежедневный счётчик «Осталось X мест»', section: 'Г', done: false },
          { title: 'Таргет на аудиторию Скрежета', section: 'Блогеры', done: false },
          { title: 'Ежедневный контент', section: 'Контент', done: false },
        ],
      },
    ],
  },
  {
    id: 'lastcall',
    name: 'ПОСЛЕДНИЙ ШАНС',
    subtitle: 'Финальный рывок',
    startDate: '2026-06-30',
    endDate: '2026-07-11',
    color: '#EF4444',
    weeks: [
      {
        number: 13, startDate: '2026-06-30', endDate: '2026-07-06',
        tasks: [
          { title: 'Финальные посты + обратный отсчёт', section: 'Контент', done: false, critical: true },
          { title: 'Инструкции: как добраться, парковка', section: 'Контент', done: false },
          { title: 'Координация с площадкой', section: 'Н', done: false },
        ],
      },
      {
        number: 14, startDate: '2026-07-07', endDate: '2026-07-11',
        tasks: [
          { title: 'Логистика + last call в соцсетях', section: 'Контент', done: false },
          { title: 'Инструкции для держателей билетов', section: 'Контент', done: false },
          { title: '11 ИЮЛЯ — ФЕСТИВАЛЬ', section: 'Н', done: false, critical: true },
        ],
      },
    ],
  },
];
