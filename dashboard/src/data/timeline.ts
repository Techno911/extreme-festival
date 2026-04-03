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
  section: string; // human-readable section name
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
          { title: 'Разослать бриф сайта 10 подрядчикам (файл: outreach-letter.md)', section: 'Сайт', done: false, critical: true },
          { title: 'Отправить питч Rock FM (файл: rockfm-pitch-final.md)', section: 'Партнёры', done: false },
          { title: 'Отправить 3 питча амбассадорам (файлы: outreach/ambassadors/)', section: 'Амбассадоры', done: false },
          { title: 'Опубликовать пост: анонс лайнапа ВК (файл: drafts/)', section: 'Контент', done: false },
        ],
      },
      {
        number: 2, startDate: '2026-04-14', endDate: '2026-04-20',
        tasks: [
          { title: 'Разослать ещё 20 брифов сайта + ждать КП', section: 'Сайт', done: false },
          { title: 'Отправить оставшиеся 7 питчей амбассадорам', section: 'Амбассадоры', done: false },
          { title: 'Опубликовать: Группа недели — Master (файл: drafts/)', section: 'Контент', done: false },
          { title: 'Опубликовать: Extreme Opros #1 (файл: drafts/)', section: 'Контент', done: false },
        ],
      },
      {
        number: 3, startDate: '2026-04-21', endDate: '2026-04-27',
        tasks: [
          { title: '15 КП по сайту в Google Sheets → оценка по скорингу', section: 'Сайт', done: false },
          { title: 'Разослать бриф трейлера 30 продакшнам', section: 'Трейлер', done: false, critical: true },
          { title: 'Оплатить посевы в 3-5 ТГ-каналах (из списка research/)', section: 'Блогеры', done: false },
          { title: 'Опубликовать: скейт-зона анонс (файл: drafts/)', section: 'Контент', done: false },
        ],
      },
      {
        number: 4, startDate: '2026-04-28', endDate: '2026-05-04',
        tasks: [
          { title: 'Созвоны с топ-3 сайтов → написать обоснование выбора', section: 'Сайт', done: false, critical: true },
          { title: '15 КП по трейлеру → оценка в Google Sheets', section: 'Трейлер', done: false },
          { title: 'Follow-up партнёрам которые не ответили (Rock FM, НАШЕ)', section: 'Партнёры', done: false },
          { title: 'Опубликовать: Fast Food серия (файл: drafts/)', section: 'Контент', done: false },
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
          { title: 'Подписать договор с подрядчиком сайта + онбординг-созвон', section: 'Сайт', done: false, critical: true },
          { title: 'Созвоны топ-3 трейлер → выбрать продакшн', section: 'Трейлер', done: false },
          { title: 'Заказать мерч: 500 наклеек + 150 нашивок + 130 футболок', section: 'Мерч', done: false },
          { title: 'Опубликовать: мерч тизер (файл: drafts/)', section: 'Контент', done: false },
        ],
      },
      {
        number: 6, startDate: '2026-05-12', endDate: '2026-05-18',
        tasks: [
          { title: 'Проверить дизайн-макет сайта от подрядчика → правки', section: 'Сайт', done: false },
          { title: 'Согласовать раскадровку трейлера + забронировать ZoonKit', section: 'Трейлер', done: false },
          { title: 'Розыгрыш 2 билетов в ВК (шаблон: drafts/розыгрыш)', section: 'Продажи', done: false },
          { title: 'Опубликовать: партнёр Ernie Ball (файл: drafts/)', section: 'Контент', done: false },
        ],
      },
      {
        number: 7, startDate: '2026-05-19', endDate: '2026-05-25',
        tasks: [
          { title: 'Проверить вёрстку сайта → список правок подрядчику', section: 'Сайт', done: false },
          { title: 'Съёмочный день трейлера (2 локации, ZoonKit)', section: 'Трейлер', done: false, critical: true },
          { title: 'Развезти флаеры по 20 точкам (список: research/физические-точки)', section: 'Блогеры', done: false },
          { title: 'Опубликовать: скетч от Оли (файл: drafts/)', section: 'Контент', done: false },
        ],
      },
      {
        number: 8, startDate: '2026-05-26', endDate: '2026-06-01',
        tasks: [
          { title: 'Приёмка сайта → ЗАПУСК extremefest.org', section: 'Сайт', done: false, critical: true },
          { title: 'Получить мерч от производителя → фото для контента', section: 'Мерч', done: false },
          { title: 'Трейлер опубликован на сайте + ВК + ТГ', section: 'Трейлер', done: false, critical: true },
          { title: 'Проверить реакции на посевы → корректировать', section: 'Блогеры', done: false },
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
          { title: 'Пост «мы другие» — факты без сравнения (файл: drafts/)', section: 'Контент', done: false },
          { title: 'Розыгрыш 2 билетов в ВК (шаблон: drafts/розыгрыш)', section: 'Продажи', done: false },
          { title: '10+ кругляшей опубликовано к 15 июня', section: 'Амбассадоры', done: false, critical: true },
        ],
      },
      {
        number: 11, startDate: '2026-06-16', endDate: '2026-06-22',
        tasks: [
          { title: 'Мониторинг реакций после Скрежета (19-21 июня)', section: 'Рынок', done: false },
          { title: 'Контент: «мы — про качество звука и отбор»', section: 'Контент', done: false },
          { title: 'Волна 3 посевов: все ТГ-каналы + региональные', section: 'Блогеры', done: false },
        ],
      },
      {
        number: 12, startDate: '2026-06-23', endDate: '2026-06-29',
        tasks: [
          { title: '5 постов/неделю: FOMO + обратный отсчёт', section: 'Контент', done: false, critical: true },
          { title: 'Ежедневный пост «Осталось X мест» (шаблон: drafts/fomo)', section: 'Продажи', done: false },
          { title: 'Таргет ВК на аудиторию метал-пабликов (бюджет 400к)', section: 'Блогеры', done: false },
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
          { title: 'Last Call: 7 дней — ежедневный пост (файл: drafts/)', section: 'Контент', done: false, critical: true },
          { title: 'Опубликовать FAQ: как добраться, парковка (файл: drafts/faq)', section: 'Контент', done: false },
          { title: 'Финальная координация с площадкой (звук, свет, скейт-зона)', section: 'Календарь', done: false },
        ],
      },
      {
        number: 14, startDate: '2026-07-07', endDate: '2026-07-11',
        tasks: [
          { title: 'Last Call: 3 дня + 1 день — финальные посты', section: 'Контент', done: false },
          { title: 'Рассылка держателям билетов: расписание + как добраться', section: 'Продажи', done: false },
          { title: '11 ИЮЛЯ — ЭСТРИМ ФЕСТ', section: 'Фестиваль', done: false, critical: true },
        ],
      },
    ],
  },
];
