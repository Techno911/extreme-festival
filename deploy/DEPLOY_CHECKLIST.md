# Deploy Checklist — ExtremeFest на VPS

> Сервер: 85.198.70.242 (chirkov.info)
> Node.js + Paperclip + Telegram bot
> Без Docker — прямой деплой

---

## PRE-FLIGHT (выполнить до деплоя)

```bash
# Проверить что пакет существует
npm show paperclipai

# Проверить RAM и disk
free -h
df -h
```

- [ ] Добавить DNS A-записи: `ef.chirkov.info` → 85.198.70.242
- [ ] Добавить DNS A-записи: `ef-bot.chirkov.info` → 85.198.70.242
- [ ] Создать Telegram-бота через @BotFather → получить `TELEGRAM_BOT_TOKEN`
- [ ] Узнать chat_id Жени: написать `@userinfobot` в Telegram
- [ ] Получить `OPENAI_API_KEY` (или решить: без Whisper)

---

## ШАГ 0: Системные требования

```bash
# 0а. Создать SWAP (обязательно — 1.9GB RAM недостаточно)
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# Проверить
free -h
# Должно показать: Swap: 2.0G

# 0б. Установить Node.js 20 LTS + pnpm
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
npm install -g pnpm@9

# Проверить
node --version   # v20.x.x
npm --version    # 10.x.x

# 0в. Установить Claude Code
npm install -g @anthropic-ai/claude-code
```

---

## ШАГ 1: Авторизация Claude Code

```bash
# На VPS — запустить
claude login
# → Вывод: "Open this URL in your browser: https://claude.ai/..."

# Открыть URL локально на Mac → авторизоваться в браузере
# Сессия сохранится в ~/.claude/ на VPS

# Запустить persistent mode
claude -P
```

---

## ШАГ 2: SSL сертификаты

```bash
# Установить certbot
apt-get install -y certbot

# Сначала добавить временный nginx server block для certbot challenge
# (в контейнер app-frontend-1)
docker exec app-frontend-1 sh -c "cat >> /etc/nginx/conf.d/ef.conf << 'EOF'
server {
    listen 80;
    server_name ef.chirkov.info ef-bot.chirkov.info;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
}
EOF"
docker exec app-frontend-1 nginx -s reload

# Получить сертификаты
certbot certonly --webroot -w /var/www/certbot -d ef.chirkov.info
certbot certonly --webroot -w /var/www/certbot -d ef-bot.chirkov.info
```

---

## ШАГ 2б: Nginx конфиг (добавить в app-frontend-1)

```nginx
# ef.chirkov.info — Paperclip UI (с basic auth)
server {
    listen 443 ssl;
    server_name ef.chirkov.info;
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

# ef-bot.chirkov.info — Telegram webhook
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

```bash
# Создать пароль для basic auth
docker exec app-frontend-1 sh -c "htpasswd -cb /etc/nginx/.htpasswd-ef artem ПАРОЛЬ_ЗДЕСЬ"
docker exec app-frontend-1 nginx -s reload
```

---

## ШАГ 3: Деплой проекта

```bash
# Создать директорию
mkdir -p /opt/extremefest /opt/backups

# Скопировать файлы с локального Mac (выполнять на Mac)
rsync -avz /Users/techno/Desktop/Extreme_festival/ root@85.198.70.242:/opt/extremefest/ \
  --exclude node_modules --exclude .git

# На VPS — установить зависимости notifier
cd /opt/extremefest/notifier
npm install

# Создать .env из примера
cp .env.example .env
nano .env   # Заполнить токены
```

---

## ШАГ 4: Paperclip

```bash
cd /opt/extremefest

# Первый запуск (онбординг)
npx paperclipai onboard --yes

# После создания компании через UI:
# http://localhost:3100 (локально через ssh tunnel)
# или https://ef.chirkov.info (после nginx)
```

---

## ШАГ 5: Systemd сервисы

```bash
# Скопировать service файлы
cp /opt/extremefest/deploy/extremefest-paperclip.service /etc/systemd/system/
cp /opt/extremefest/deploy/extremefest-notifier.service /etc/systemd/system/

# Включить и запустить
systemctl daemon-reload
systemctl enable extremefest-paperclip extremefest-notifier
systemctl start extremefest-paperclip
systemctl start extremefest-notifier

# Проверить статус
systemctl status extremefest-paperclip
systemctl status extremefest-notifier
```

---

## ШАГ 6: Webhook для Telegram

```bash
# Зарегистрировать webhook
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -d "url=https://ef-bot.chirkov.info/telegram/webhook"

# Проверить
curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"
```

---

## ШАГ 7: Crontab

```bash
# Создать директорию для backups
mkdir -p /var/log

# Добавить cron задачи
crontab -l > /tmp/current_cron
cat /opt/extremefest/deploy/crontab.txt >> /tmp/current_cron
crontab /tmp/current_cron

# Проверить
crontab -l
```

---

## ШАГ 8: Smoke Test

```bash
# Проверить что бот отвечает
# Написать боту /start

# Проверить Paperclip UI
curl https://ef.chirkov.info -u artem:ПАРОЛЬ

# Проверить дайджест вручную
cd /opt/extremefest
node notifier/digest.js
```

---

## ЕСЛИ ЧТО-ТО СЛОМАЛОСЬ

```bash
# Логи Paperclip
journalctl -u extremefest-paperclip -f

# Логи бота
journalctl -u extremefest-notifier -f

# Логи дайджеста
tail -f /var/log/extremefest-digest.log

# Перезапуск
systemctl restart extremefest-notifier
systemctl restart extremefest-paperclip
```
