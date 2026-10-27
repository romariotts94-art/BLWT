# Public care guide and stock video demonstration

Implemented locally on 2026-10-26. No remote publication was performed.

## Pages and intent

- `/care-guide`: public educational companion to the existing academy, separate from booking and operations.
- `github-pages/care-guide.html`: equivalent static entry for the `/BLWT/` Pages build.
- Home section `#equipment`: real links from all six product/equipment cards to the relevant guide sections.
- Home section `#live-feature`: stock demonstration, not footage of an actual order, a promise of employee status, or a training demonstration of the depicted cleaning technique.

The guide describes independent self-employed service providers. It does not assert that every provider completed the academy or uses listed brands. The actual kit/method and any substitutions are to be agreed with the client. It does not exclude statutory consumer rights or liability. Existing contractual/payment drafts were not changed.

## Primary product documentation

1. PROSEPT Multipower Neutral, 158-1: https://prosept.ru/catalog/bytovaya_khimiya/multipower_neutral-_sredstvo_dlya_mytya_polov_vsekh_tipov/
   - Manual maintenance cleaning: 2–5 ml per litre of water; concentrate pH 7. Different regimes are not included in the educational calculator.
   - Image source: https://prosept.ru/upload/iblock/a07/a0799fd80dddd56b8c923516354af23b.jpg
2. Green Care Professional TANET SR 15: https://www.green-care-professional.com/at/produkte/tanet-sr-15/
   - Alcohol-based floor/surface cleaner; application concentrations from 0.25%. Manufacturer page provides SDS links for individual sizes.
   - Image source: https://dms-werner-mertz.s3.eu-central-1.amazonaws.com/files/shares/product-pictures/tanet-sr-15/conversions/tanet-sr-15-1l-side-web-detail.png
3. PROSEPT Cooky without fragrance, 132-05: https://prosept.ru/catalog/uborka_kukhni_-cooky/cooky-_gel_dlya_mytya_posudy_vruchnuyu-_bez_tsveta_i_zapakha/
   - Hand dishwashing: 2–3 ml on wet sponge/dishes, rinse. No added fragrance/dye; this is not an allergy-free guarantee.
   - Image source: https://prosept.ru/upload/iblock/5ad/6b3rmwsffdmz7h76xh23bofvyx3jrdgf.jpg
   - The manufacturer's introductory pH wording and detailed pH number differ; no exact pH claim is made for this product on the new page.

Manufacturer packshots identify the referenced products and are attributed in the guide. No endorsement/partnership claim. Moscow supplier links (Vikont and Opticom) are recorded alongside each item in `lib/care-guide.ts`; stock and prices are intentionally not promised.

## Educational and legal context

- Existing project curriculum: `lib/cleaner-handbook.ts`; neutral cleaner and Cooky are already included there.
- Stone care: https://www.naturalstoneinstitute.org/consumers/care/
- Safety handling: https://www.osha.gov/sites/default/files/publications/OSHA3512.pdf
- EU approach: https://environment.ec.europa.eu/news/building-circular-economy-eu-ecolabel-2026-07-08_en
- US approach: https://www.epa.gov/saferchoice
- Aggregator information and responsibility: https://zpp.rospotrebnadzor.ru/news/federal/593811

EU Ecolabel and EPA Safer Choice inspire clear, verifiable information. The guide does not represent all curated products as certified by either program. Material care is conditional on the exact finish, manufacturer instructions and a compatibility test.

## Video assets and licences

- `vision-cleaning.mp4`: Liliana Drew, “A woman is using a vacuum cleaner in her room”, https://www.pexels.com/video/a-woman-is-using-a-vacuum-cleaner-in-her-room-9473228/
  - https://videos.pexels.com/video-files/9473228/9473228-hd_720_1280_24fps.mp4
  - Pexels licence: https://www.pexels.com/license/ ; stock video use allowed including commercial context; no endorsement by the depicted person is implied.
- `vision-dusting.mp4`: Mixkit, “Woman cleaning her house dancing”, https://mixkit.co/free-stock-video/woman-cleaning-her-house-dancing-43369/
  - https://assets.mixkit.co/videos/43369/43369-720.mp4
  - Asset page and VideoObject metadata identify Mixkit Stock Video Free License, https://mixkit.co/license/#videoFree (not Restricted License).
- Posters are still frames from their corresponding clips. Videos have no visible fake live timestamp or recording indicator and always play muted. Credits and “stock demonstration, not a real order” appear beside the player.
- No stock footage depicts an actual Black & White cleaner or client. These clips illustrate the interface, not a recommended technical cleaning method.

The player loads only after entering the viewport; pauses outside it and when the tab is hidden; respects reduced motion, supports pause/manual clip selection, and shows a poster/retry action on video failure.
