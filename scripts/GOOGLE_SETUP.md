# Настройка Google OAuth2 для SMM-таблицы

Одноразовая процедура. Занимает 10 минут.

---

## Шаг 1 — Создай проект в Google Cloud

1. Открой [console.cloud.google.com](https://console.cloud.google.com)
2. Вверху слева: выпадушка с проектами → **Новый проект**
3. Название: `ExtremeFest-SMM` → **Создать**

---

## Шаг 2 — Включи нужные API

В левом меню: **API и сервисы → Библиотека**

Найди и включи оба:
- **Google Sheets API**
- **Google Drive API**

---

## Шаг 3 — Создай OAuth2-клиент

1. **API и сервисы → Учётные данные**
2. **+ Создать учётные данные → Идентификатор клиента OAuth**
3. Тип: **Настольное приложение** (Desktop app)
4. Имя: `ExtremeFest Local`
5. **Создать** → появится окно с client_id и client_secret
6. Нажми **Скачать JSON**
7. Переименуй скачанный файл в `.google-credentials.json`
8. Положи его в папку `notifier/`:
   ```
   notifier/.google-credentials.json
   ```

> Если спросит про "Экран согласия OAuth" — выбери **Внешний**,
> добавь свою почту как тестового пользователя.

---

## Шаг 4 — Авторизуйся

```bash
node scripts/google-auth-setup.js
```

- Откроется браузер
- Войди в Google-аккаунт, разреши доступ
- Скрипт поймает callback и сохранит токен в `notifier/.google-token.json`

---

## Шаг 5 — Создай таблицу

```bash
node scripts/init-smm-sheet.js
```

Опционально: добавь в `notifier/.env` перед запуском:

```env
ZHENYA_EMAIL=zhenya@example.com
```

Тогда Женя автоматически получит письмо с доступом.

---

## Шаг 6 — Мигрируй черновики в таблицу

```bash
node scripts/migrate-drafts-to-sheet.js
```

Скрипт прочитает все 25 файлов из `output/drafts/` и запишет их
в лист «Контентная» со статусом «Черновик». Занимает ~30 секунд.

---

## Шаг 7 — Готово

`init-smm-sheet.js` выведет ссылку на таблицу. Отправь её Жене.

---

## Если что-то пошло не так

**"redirect_uri_mismatch"** — в Google Cloud, в настройках OAuth-клиента,
добавь в список разрешённых URI: `http://localhost:3000/oauth2callback`

**"invalid_grant"** — токен устарел, запусти `google-auth-setup.js` снова.

**"The caller does not have permission"** — проверь, что ты включил
Google Sheets API и Google Drive API (шаг 2).
