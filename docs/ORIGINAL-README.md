# Black and White

Рабочий закрытый пилот клининговой платформы: клиент, команда, CRM, московские тарифы, фотоотчёты и приватный WebRTC-эфир с телефона. Оплата — заглушка по заданию.

Архитектура, формулы и границы готовности: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Команды
- `npm run dev` — локальный Vinext, loopback preview.
- `npm run db:generate` — генерация миграций.
- `node --experimental-strip-types --test tests/domain.test.mjs` — проверка калькулятора и инвариантов.
- `npx tsc --noEmit` — проверка TypeScript.
- Сборка/публикация: Sites skill; `.openai/hosting.json` сохраняет текущий project_id.

Локальные D1 миграции — через Wrangler с `dist/server/wrangler.json`, после сборки. Production migrations применяются Sites. `.dev.vars` не коммитится. Для локального mock-входа допускается только `ADMIN_EMAILS=seedy@sites.test`; на production этот адрес не настраивается.

## Runtime
`DB`, `BUCKET` — bindings. `ADMIN_EMAILS` — список администраторов, `TURN_URLS`, `TURN_USERNAME`, `TURN_CREDENTIAL` — видеореле. Реальные секреты только в runtime, не в Git. В закрытом Sites пилоте используется вход ChatGPT.

## Работа
Создать команду → настроить email/роли сотрудников → предоставить доступ Sites → вход сотрудников → клиентская заявка → CRM предлагает → бригадир принимает → выезд → уборка → эфир/чек-лист/фото → приёмка.

На сайте в CRM есть раздел «Готовность к запуску» с обязательными подключениями. Реальная камера не имитируется фотографиями или таймером. Состояние LIVE связано с соединением. Видео не записывается. Фоновые уведомления и платежи не подключены.
