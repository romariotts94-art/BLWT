# Посуточная аренда: визуальные материалы

Создано встроенным imagegen. Финальные файлы находятся в проекте:

- `public/media/rental-bedroom-before.webp` — квартира после выезда гостей, 1536 × 1024.
- `public/media/rental-bedroom-after.webp` — тот же ракурс после уборки, 1536 × 1024.
- `public/media/cleaning-kitten-towels.webp` — прозрачный спрайт того же котика, складывающего полотенца, четыре кадра, 2172 × 724.

Подключение: `components/MarketingHome.tsx`, `app/marketing.css`. Существующий механизм показывает прогресс за 3000 мс и плавно открывает чистое фото. Для карточки посуточной аренды предусмотрены наведение, фокус клавиатуры и нажатие. Размеры карточек и основного блока сохранены.

## Промпт фотографии до уборки

Use case: photorealistic-natural. Create ONE landscape 1536x1024 photograph for a Russian cleaning website, BEFORE turnover cleaning of a short-term rental apartment after guests have checked out. Beautiful cheerful creative Moscow city apartment bedroom / small studio, no people or animals. Eye-level interior editorial photography, warm daylight, upholstered teal bed headboard on left-center, coral and apricot accents, tasteful abstract art without text, oak floor, round small table in foreground right, curved mustard chair, green plant near broad white-framed window. Outside only softly defocused neutral Moscow apartment facades, no foreign landmarks. Keep main bed and table in central field to work cropped square. Realistically untidy after a weekend stay: rumpled white duvet and pillows, used towels draped over chair and on floor, a couple coffee cups and takeaway wrappers on table, crumbs and a few dusty footprints on oak floor. Furniture remains beautiful and intact, not abandoned or disgusting. Visually evident mess but uplifting sunshine and colors. No text, labels, watermarks, collage, split-screen or frames. This will be edited into an exactly matching clean image, so stable straight architecture and simple furniture.

## Промпт редактирования фотографии после уборки

Входное изображение: фотография до уборки.

Use case: precise-object-edit. Edit this EXACT apartment photograph into AFTER short-term rental turnover cleaning. Preserve exact camera position, crop, image dimensions, perspective, all furniture placement, headboard geometry, painting, plants, lamps, curtains, windows and same exterior buildings, lighting and shadows. Only change cleaning state: make bed beautifully with smooth clean white duvet, upright orderly white pillows and neatly folded coral throw across foot; remove all dirty cups glasses wrappers tissues and crumbs from round table and bedside table, leave round table empty and clean; remove loose used towels from chair and floor; place one small neat stack of fresh white guest towels on the foot of the bed; remove ALL dusty footprints and debris from oak floor and clean rug. Keep mustard chair exactly in place and entirely visible without towels. Happy warm realistic editorial photograph, same colors and architecture. This pair will crossfade so identical alignment is essential. No people or cats, text, watermark, collage or new furniture.

## Промпт котика

Референс персонажа: `public/media/cleaning-kitten-wiping.webp`. Прозрачный фон включён при генерации.

Use case: identity-preserve, animated website sprite sheet. Reference image is the EXACT established mascot identity and rendered cartoon style to keep: cute contemporary animated film black-and-white tuxedo kitten, huge green eyes, pink nose, white face blaze muzzle chest and paws, rounded black ears/body, fluffy soft fur, happy expression. Create ONE transparent PNG sprite sheet aspect ratio exactly 3:1, four equally spaced frames in a single horizontal row, each frame occupying one equal quarter with 8% safe transparent margins and identical camera, scale, foot baseline, head size and same pale mint little table position. New action: kitten folds a fresh white fluffy guest towel for a rental apartment. Frame1 both paws holding open white towel just above table, frame2 bringing one side over to fold, frame3 gently pressing the neatly folded towel with both paws and happy closed eyes, frame4 contentedly presenting neat small towel stack with open green eyes; continuous small gestures, no jumping positions. Show full kitten including feet and tail, complete table and towel entirely within EACH cell. No wiping cloth, no repair tools. Keep character EXACTLY same as reference, not a new cat. True transparent alpha background everywhere outside four isolated characters and tables; no colored outline, stray pixels, glows, checkered background, text, watermarks, borders, grid lines or cast floor shadows.
