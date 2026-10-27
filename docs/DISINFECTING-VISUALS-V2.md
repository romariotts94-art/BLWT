# Дезинфекция — переработанный визуальный сценарий v2

Создано встроенным imagegen. Старые изображения кухни сохранены, но не используются карточкой.

## Файлы

- `public/media/disinfecting-bedroom-before-v2.png`: аккуратная тёмная почти монохромная спальня с насекомыми.
- `public/media/disinfecting-bedroom-after-v2.png`: та же спальня без насекомых, светлая бело-молочная палитра.
- `public/media/cleaning-kitten-hazmat-v2.png`: прозрачный спрайт 2×2; верхние кадры — противогаз, костюм со знаком радиации, распылитель; нижние — без маски, довольный вдох и выдох.

## Поведение

За первые 3 секунды идёт прежняя загрузка, котик распыляет средство. При переходе к светлой комнате переключается на кадры без маски; два заметных цикла вдоха/выдоха по 1,8 секунды, затем плавное исчезновение. Круг скрывается отдельно, котик остаётся видимым ещё 4,1 секунды. Размеры карточек и блока не менялись. При reduced-motion котик статичен.

Это художественная демонстрация по запросу пользователя: клопы относятся к дезинсекции, а не дезинфекции; знак радиации — деталь костюма, а не обозначение метода услуги. Цвет изображения не доказывает стерильность; 3 секунды не являются реальным временем обработки. Название и условия существующей услуги не изменялись.

## Промпт до

Use case: photorealistic-natural. Create a landscape 1536x1024 BEFORE image for a stylized pest-treatment before/after illustration on a Russian cleaning website. Tasteful modern Moscow apartment bedroom: neatly made ivory upholstered bed in center, white linen duvet, rounded pale bedside tables, sculptural milk-white pendant lamps, light oak floor, sheer white curtains at left, minimal abstract framed art, upholstered ivory reading chair right. Camera eye level wide interior photograph; no foreign landmarks. Everything is TIDY, intact, NO dirt, stains, rubbish or mess. Atmosphere dark, low-key, near black-and-white with cool gray tones and muted contrast while clearly readable. Many small visibly recognizable dark brown oval bedbugs scattered along duvet edge, pillows, headboard seams, side tables and floor edges; show them small but visible in a website preview, NOT giant monsters or cockroaches. Approx 35 small bugs, distributed through central safe crop. Editorial cinematic photo, not horror or gore. No people, cat, text, symbol, watermark. Later after edit will preserve geometry exactly but remove bugs and change lighting to bright white airy high-key.

## Промпт после

Use case: lighting-weather and precise-object-edit. Edit this exact bedroom BEFORE photo into matching AFTER. Remove EVERY insect from bed, pillows, headboard, tables, chair, curtain, rug and floor. Change only lighting/color treatment to luminous high-key daytime, airy white and ivory palette, pearly light gray subtle shadows, immaculate calm almost sterile-feeling freshness. Keep whites detailed, not blown out. Same room, absolutely identical camera crop perspective furniture positioning and shapes, bedding folds, pillows, rug, art, lamps, vases, books, curtains, plants. Do NOT add or remove furnishings, do NOT remodel room. Restore subtle natural warm ivory/pale wood tones under bright soft white daylight. No people, kitten, chemicals, fog, floating particles, insects, text, logos or watermark. Exact same 1536x1024 landscape framing; this is a visual metaphor for treatment, not scientific sterility proof.

## Промпт котика

Use case: identity-preserve. Input reference: preserve this exact cute black-and-white cartoon kitten identity (green eyes, central white face stripe, pink nose, white paws and chest, black ears and tail, modern 3D animated-movie aesthetic). Create a NEW transparent sprite sheet, PORTRAIT 3:4 canvas, exactly FOUR frames in a 2x2 grid. Each cell portrait 3:4; all characters same scale, baseline and centered with at least 12% transparent margin; all props tail ears and feet inside cells. TOP LEFT: kitten in pale yellow protective coverall with yellow-and-black radiation trefoil chest patch, full dark gray vintage Chernobyl-style gas mask with round clear eyepieces and round filter, holding professional handheld pump SPRAYER connected by hose to small tank at hip; nozzle points outward right/down. TOP RIGHT: same masked kitten and gear, slightly shifted paw, operating sprayer with fine small mist at nozzle pointed right away from face. BOTTOM LEFT: exact same kitten after treatment, hood down, completely NO mask on face, protective gear and sprayer neatly lowered at its side, no mist. Eyes peacefully closed, chin gently lifted, small smile, chest expanded and shoulders raised, enjoying a deep fresh-air INHALE. BOTTOM RIGHT: same maskless kitten, soft delighted smile, closed eyes, chest relaxed and shoulders lowered, gentle contented EXHALE. No table, cloth, kitchen, separate floating equipment, text, letters, background, floor, debris or sparkles. True transparent alpha. Maintain clean four separate animation cells without overlaps. Maskless frames must retain the reference face. Symbol is theatrical cartoon costume detail.

