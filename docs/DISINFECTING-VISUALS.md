# Визуалы «Дезинфекция»

Созданы встроенным imagegen, сохранены локально в проекте.

- `public/media/disinfecting-kitchen-before.png` — кухня до уборки.
- `public/media/disinfecting-kitchen-after.png` — та же кухня после уборки.
- `public/media/cleaning-kitten-disinfecting.png` — прозрачный лист из четырёх кадров: распыление, обработка, протирание, завершение.

Наведение и фокус на карточке запускают существующий трёхсекундный прогресс; миниатюра показывает чистое фото, большой блок — сначала грязное, затем плавно чистое. Размеры и пропорции не изменены. Иллюстрация не подтверждает микробиологическую чистоту; три секунды — длительность анимации, не время экспозиции средства. Описание услуги и требования к обработке сохранены.

## Промпт «До»

Use case: photorealistic-natural. Asset type: BEFORE photograph for a stylish Russian home cleaning website, paired before/after disinfection service illustration. One landscape 1536x1024 editorial interior photo. A cheerful designer apartment kitchen, pale butter-yellow cabinets, terracotta backsplash, stainless steel faucet and white sink, large white speckled quartz island in foreground, mint bar stools, bright daylight, small leafy plant, simple peach ceramic vase. Warm inviting uplifting mood, realistic materials, tasteful contemporary Russian apartment, no foreign landmarks, window only leafy courtyard. Wide eye-level framing, kitchen island countertop and faucet clearly visible in central safe area for crop. BEFORE: visible greasy fingerprints and dried food smears on island, crumbs, two used cups, small stained dishcloth by sink, water spots on faucet and backsplash. Moderately lived-in, not disgusting, no mold. No people, pets, insects, cartoon germs, written text, logos or watermark. Preserve furniture beautiful and fully intact. No hourglass or pocket watch, this is a distinct service kitchen.

## Промпт «После»

Use case: precise-object-edit. Edit target: this exact BEFORE kitchen photograph. Make the matching AFTER cleaned kitchen photo for a disinfection-service illustrative preview. Remove only dirty cups, used plate and croissant, all crumbs, stains, greasy fingerprints, water spots and dirty dishcloth. Clean countertop, sink, faucet, cabinets and backsplash. Keep vase with branches, fruit bowl, soap dispenser, all kitchen furnishings and back counter items in exactly same positions. Do not add objects. Preserve camera, crop, perspective, cabinet doors, sink geometry, stools, quartz pattern, shadows, warm sunlight, window greenery, colors and resolution 1536x1024. The faucet is OFF, no falling water droplets. Attractive clean dry surfaces, realistic not artificially glowing. No people, no cats, no germs, no writing, no watermark. This shows visible cleanliness, not a scientific claim of sterility.

## Промпт котика

Use case: identity-preserve. Reference image: existing black-white kitten four-frame sprite sheet, preserve EXACT same kitten face, green eyes, white central face stripe, white cheeks belly paws, pink nose, black ears and tail, cute modern animated-movie rendering. Create NEW transparent four-frame sprite sheet in ONE HORIZONTAL ROW, 3:1 overall aspect ratio, four equal portrait cells, each 3:4 ratio. Same scale and baseline every cell, generous transparent margins, whole body and props inside each cell. New action: kitten wearing small mint cleaning apron and mint gloves cleaning a tiny low coral tabletop with spray bottle and yellow microfiber cloth. Frame1 holds mint spray bottle pointed DOWN toward tabletop, cloth in other paw. Frame2 presses trigger with small fine mist directed only at surface, not face. Frame3 puts bottle beside table and wipes surface left-to-right with cloth. Frame4 finishes wipe, smiles proudly at clean tabletop. Matching tiny tabletop same position across frames. No dustpan, confetti, broom, clocks. No text, logos, sparkles or floating debris. True clean transparent alpha background, no ground or scene. Polished cute 3D cartoon, not realistic animal. Four clean separated animation frames, no overlapping neighbors or clipped body parts.

