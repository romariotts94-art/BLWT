# После мероприятия: визуальные материалы

Создано встроенным imagegen. Изображения проверены визуально до подключения.

- `public/media/event-living-room-before.png` — гостиная после праздника.
- `public/media/event-living-room-after.png` — тот же интерьер после уборки.
- `public/media/cleaning-kitten-confetti.png` — четыре кадра того же котика со щёткой и совком на прозрачном фоне.

Наведение и фокус на карточке запускают существующий трёхсекундный переход до/после; нажатие также выбирает услугу. Размеры и пропорции блоков сохранены.

## Промпт до уборки

Use case: photorealistic-natural. ONE landscape 1536x1024 editorial interior photograph, BEFORE cleaning after a small birthday celebration in a stylish Moscow apartment living/dining room. Joyful creative coral, lavender, butter-yellow palette, natural warm daylight, white-framed windows with softly blurred typical Moscow apartment facades, no foreign landmarks. Elegant lavender curved sofa in back, cheerful framed abstract art without words, oak floor, oval oak dining table central foreground with four tasteful chairs, coral cabinet, fresh flowers in a vase. Party decorations remain attached neatly to wall: a tasteful pastel paper garland and small bunch of balloons in corner. Mess clearly visible: used plates with cake crumbs, paper cups, napkins, snack wrappers on dining table; colorful paper confetti and ribbons scattered across floor; sofa cushions casually disarranged. No people, cats, logos, writing, collage or split screen. Beautiful cheerful lived-in space, not ruined, natural realistic textures. Composition main table and sofa in middle of frame so square crop works. Fixed eye-level wide shot with straight architecture for an exact clean-state edit later.

## Промпт после уборки

Редактирование фотографии до уборки.

Use case: precise-object-edit. Edit this EXACT photograph into AFTER event cleaning. Pixel-aligned same camera/crop/dimensions/perspective, keep every furniture item and chair in exactly same position, same windows Moscow buildings plants artwork lamps warm sunlight and shadows. Keep wall garland and balloon bouquet intact: cheerful celebration decor stays. ONLY remove all used plates, glasses, cups, cake stand, cutlery, food, napkins and wrappers from dining table and little round sofa side table; retain both flower vases and flowers exactly in place. Remove ALL confetti and ribbons from floor, rug and table, including under chairs and at frame edges. Clean all surfaces and oak floor, straighten sofa cushions and neatly fold its throw. Absolutely clean post-event room with cheerful color and natural textures, no sterile redesign. No added objects, no people/cats, text, watermarks, split-screen or collage. Exact scene matching for a smooth before-after crossfade.

## Промпт котика

Референс: `public/media/cleaning-kitten-towels.png`.

Use case: identity-preserve. Create ONE animated website sprite sheet using this reference only for the exact mascot identity: same cute black-and-white tuxedo kitten, oversized green eyes, pink nose, white blaze muzzle chest paws, black fluffy ears and curved tail, modern animated-film 3D cartoon. New action: crouching happily, using a tiny mint hand brush to sweep colorful paper confetti into a small coral dustpan after a party. NO TABLE and no towels. Exactly four equal-width frames in ONE horizontal row, full image aspect ratio 3:1. Same kitten scale, body/head proportions, position, foot baseline and camera in all cells, all paws ears tail and tools entirely inside their cell with generous transparent padding. Frame1 brush poised to kitten's left beside a small pile of pastel confetti, other paw holds dustpan on ground to right. Frame2 brush pushes confetti toward dustpan. Frame3 brush reaches dustpan, confetti inside it, kitten happily squints. Frame4 kitten slightly raises filled dustpan proudly with green eyes open. Only a small deliberate group of 6-8 confetti pieces close to tools in each frame, not a spray of random dots. Crisp isolated silhouette with clean edges, no stray colored fragments, no floor/background, no glow, no checkered background, no captions, no borders. True transparent alpha PNG. Preserve the exact friendly cat identity from reference.

## Уточнение расположения кадров

Edit target: this four-frame kitten sprite sheet. Keep exactly these four poses and this same cat, colors and tools. Fix ONLY sprite-sheet layout and alpha edges. Canvas exactly 2172 by 724. Four equal cells, each 543 pixels wide, boundaries at x=0,543,1086,1629,2172. Scale each COMPLETE character AND all tools/confetti together down to fit within 440 pixels wide and 600 pixels high, then center in its own cell with at least 50 pixels EMPTY transparent padding to left and right, align foot/brush baseline at y=660. All ears, whiskers, tail, paws, dustpan and confetti must remain INSIDE each own cell without any overlap into neighboring quarter. Maintain same scale across all four. Clean transparent edges, remove stray specks / colored outline artifacts, keep only intended large confetti pieces near brush. No grids, text, borders, background or extra characters. True transparent PNG. Four evenly spaced isolated cat scenes in one row, generous empty margins essential.

