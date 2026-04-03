# Pre-development checklist: ExtremeFest × Paperclip

## Context
Перед развёртыванием проекта ExtremeFest на сервере необходимо устранить ряд критических проблем и пробелов, выявленных при аудите архитектурного файла v4 и живой проверке сервера. Без этих действий деплой либо не запустится, либо упадёт в первые часы работы.

---

## Находки аудита сервера (live, 2026-03-31)

### Что НЕ установлено (всё с нуля)
| Инструмент | Статус |
|---|---|
| Node.js / npm | ❌ NOT INSTALLED |
| pnpm | ❌ NOT INSTALLED |
| Claude Code | ❌ NOT INSTALLED |
| Paperclip (paperclipai) | ❌ NOT INSTALLED |
| /opt/extremefest | ❌ DIR NOT EXISTS |

### Что хорошо
- Порты 3001 и 3100 — свободны ✓
- Диск: 13 GB свободно (58% занято) ✓
- Кронтаб существующих платформ не конфликтует ✓
- Docker-сети для 3 платформ не затронут ExtremeFest (проект без контейнеров) ✓

---

## Критические риски и решения (согласовано)

### 1. 🔴 Нет SWAP — риск OOM при запуске агентов
RAM 1.9GB, swap = 0. Node.js + Paperclip + 6 Claude агентов = потенциальный OOM killer.
```bash
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

### 2. 🔴 Telegram webhook HTTPS — Вариант А (nginx + SSL)
Telegram принимает webhook только по HTTPS. Решение: добавить новый server block в nginx внутри контейнера `app-frontend-1`, получить SSL-сертификат через certbot.

**Субдомен:** `ef-bot.chirkov.info` (нужно добавить A-запись в DNS → 85.198.70.242)

**Nginx server block (добавить в `app-frontend-1`):**
```nginx
server {
    listen 80;
    server_name ef-bot.chirkov.info;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 301 https://$host$request_uri; }
}
server {
    listen 443 ssl;
    server_name ef-bot.chirkov.info;
    ssl_certificate /etc/letsencrypt/live/ef-bot.chirkov.info/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ef-bot.chirkov.info/privkey.pem;
    resolver 127.0.0.11 valid=30s ipv6=off;
    location /telegram/webhook {
        proxy_pass http://host.docker.internal:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

**Получить сертификат (на хосте, не в контейнере):**
```bash
certbot certonly --webroot -w /var/www/certbot -d ef-bot.chirkov.info
# Перезагрузить nginx: docker exec app-frontend-1 nginx -s reload
```

### 3. 🟡 claude -P на headless VPS — эффективный метод
`claude login` на VPS выводит URL. Нужно открыть его локально на Mac.

**Метод (1 минута):**
```bash
# На VPS — запустить и скопировать URL из вывода
claude login
# → Вывод: "Open this URL in your browser: https://claude.ai/..."

# Открыть URL на локальном Mac, авторизоваться через браузер
# Сессия сохраняется в ~/.claude/ на VPS автоматически
claude -P  # запустить persistent mode
```

### 4. 🟡 Порт 3100 (Paperclip UI) — защита через nginx basic auth
Firewall неактивен, 3100 открыт всем. Защита без риска сломать другие платформы.

**Добавить server block в `app-frontend-1`:**
```nginx
server {
    listen 443 ssl;
    server_name ef.chirkov.info;   # субдомен для UI
    ssl_certificate /etc/letsencrypt/live/ef.chirkov.info/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ef.chirkov.info/privkey.pem;
    resolver 127.0.0.11 valid=30s ipv6=off;
    auth_basic "ExtremeFest";
    auth_basic_user_file /etc/nginx/.htpasswd-ef;
    location / {
        proxy_pass http://host.docker.internal:3100;
        proxy_set_header Host $host;
    }
}
```

```bash
# Создать пароль (внутри контейнера)
docker exec app-frontend-1 sh -c "htpasswd -cb /etc/nginx/.htpasswd-ef artem ПАРОЛЬ"
```

> Два новых субдомена нужны: `ef.chirkov.info` и `ef-bot.chirkov.info` → добавить A-записи в DNS.

### 5. 🟡 ExtremeFest_Context.md — создать из Fireflies
Файл 25K слов не существует. Нужно создать из транскриптов звонков в Fireflies.

**Содержание файла (по разделу 8.2 архитектуры):**
- Дата/место/формат фестиваля
- Лайнап (12 групп, иностранный хедлайнер, Master)
- Цены билетов (2900–5000₽), TicketsCloud, 15-16 продано на 14.03
- Бюджет маркетинга, ограничения
- Конкуренты (Скрежет металла, Китаев 11 июля)
- Контакты (Женя, Женя Косырев, Давид, Оля)
- Формат площадки (2 сцены, скейт-зона, вместимость 1400)
- Ограничения: не критиковать Master/Грановского, не AI-арт, один исполнитель (Женя)

**Действие:** Использовать Fireflies MCP для получения транскриптов и создать файл.

---

## Пробелы в архитектуре (нужно дописать при разработке)

### notifier/bot.js — код не предоставлен
**NPM зависимости:**
```json
{
  "dependencies": {
    "node-telegram-bot-api": "^0.66",
    "openai": "^4",
    "axios": "^1",
    "dotenv": "^16"
  }
}
```

### .env.example (единый шаблон)
```
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_URL=https://ef-bot.chirkov.info/telegram/webhook
PAPERCLIP_API_KEY=
PAPERCLIP_BASE_URL=http://localhost:3100
OPENAI_API_KEY=           # для Whisper API
NODE_ENV=production
```

### Systemd сервисы вместо nohup
`/etc/systemd/system/extremefest-paperclip.service` + `extremefest-notifier.service` — автозапуск при reboot.

### Backup в crontab
```
0 3 * * * tar -czf /opt/backups/extremefest_$(date +\%Y\%m\%d).tar.gz /opt/extremefest/output/ 2>/dev/null
```

---

## Полный чеклист — обновлённый порядок шагов

```
PRE-FLIGHT:
□ Проверить paperclipai: npm show paperclipai  (убедиться что пакет существует)
□ Добавить DNS A-записи: ef.chirkov.info и ef-bot.chirkov.info → 85.198.70.242
□ Создать Telegram-бота через @BotFather → получить TELEGRAM_BOT_TOKEN
□ Получить OPENAI_API_KEY (или решить: локальный Whisper)

ШАГИ (порядок критичен):
□ 0а. Создать swap 2GB
□ 0б. apt install -y nodejs npm  + npm install -g pnpm@9 @anthropic-ai/claude-code
□ 1.  claude login на VPS → авторизовать URL на локальном Mac → claude -P
□ 2а. Добавить DNS записи + получить SSL сертификаты (ef + ef-bot)
□ 2б. Добавить nginx server blocks в app-frontend-1 + htpasswd + reload
□ 2в. mkdir /opt/extremefest && npx paperclipai onboard --yes
□ 3а. Написать notifier/bot.js + templates.js + package.json + .env
□ 3б. Webhook: зарегистрировать в Telegram — POST https://api.telegram.org/bot{TOKEN}/setWebhook?url=https://ef-bot.chirkov.info/telegram/webhook
□ 4.  В UI (ef.chirkov.info): Company, Goal, 6 агентов по разделу 3
□ 5.  Создать ExtremeFest_Context.md из Fireflies + скопировать в context/
□ 5б. Скопировать весь проект (.claude/, context/, output/) в /opt/extremefest/
□ 6.  Создать Issues по разделу 6 архитектуры (AJTBD-01 → AJTBD-06 + День 1)
□ 7а. Создать systemd сервисы + enable + start
□ 7б. Добавить backup в crontab
□ 7в. Smoke test: /check-status → /research "метал-фестивали Москва" → /validate-idea "раздать 100 бесплатных билетов"
```

---

## Файлы для создания/изменения

| Файл | Действие | Приоритет |
|---|---|---|
| `/opt/extremefest/notifier/bot.js` | Написать | 🔴 Блокирующий |
| `/opt/extremefest/notifier/package.json` | Написать | 🔴 Блокирующий |
| `/opt/extremefest/notifier/.env` | Заполнить токенами | 🔴 Блокирующий |
| Nginx конфиг в `app-frontend-1` | 2 server block (ef + ef-bot) | 🔴 Блокирующий |
| `/etc/systemd/system/extremefest-paperclip.service` | Написать | 🟡 Важный |
| `/etc/systemd/system/extremefest-notifier.service` | Написать | 🟡 Важный |
| Crontab | Добавить backup строку | 🟡 Важный |
| `context/ExtremeFest_Context.md` | Создать из Fireflies | 🔴 Блокирующий |
| `/Users/techno/Desktop/Extreme_festival/EXTREMEFEST_PAPERCLIP_ARCHITECTURE_v4.md` | Обновить секцию инфраструктуры | 🔵 Желательно |
