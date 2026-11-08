// Shared by the web app and the minute-by-minute offer broadcaster.
// Keep discovery, acceptance and notifications on the same eligibility rule.
export function offerEligibilityWhere(postgres, cityId) {
 const detail=(field)=>postgres?`(o.details::jsonb->>'${field}')`:`json_extract(o.details,'$.${field}')`;
 const preference=(field)=>postgres?`(o.details::jsonb->'preferences'->>'${field}')`:`json_extract(o.details,'$.preferences.${field}')`;
 const quoteAcceptedSql=postgres?"(o.details::jsonb->>'quoteAccepted')::boolean":"json_extract(o.details,'$.quoteAccepted')=1";
 const quotedWorkers=postgres?"(o.details::jsonb->'quote'->>'workers')":"json_extract(o.details,'$.quote.workers')";
 const orderHours=postgres?"(o.details::jsonb->'quote'->>'hours')":"json_extract(o.details,'$.quote.hours')";
 const proof=(field)=>postgres?`(nonip.value::jsonb->>'${field}')`:`json_extract(nonip.value,'$.${field}')`;
 const personalUseSql=postgres?`${detail('personalUse')}='true'`:`${detail('personalUse')}=1`;
 return `
 o.marketplace_version=1 AND o.status='offered' AND o.city_id='${cityId}' AND ${quoteAcceptedSql} AND o.start_at>? AND CAST(${quotedWorkers} AS INTEGER)=1 AND ${personalUseSql} AND COALESCE(${detail('service')},'') NOT IN ('office','commercial','rental') AND COALESCE(${detail('catalogService')},'') NOT IN ('office','commercial','rental')
 AND m.active=1 AND m.role IN ('cleaner','leader') AND m.id<>o.client_id
 AND EXISTS (SELECT 1 FROM worker_profiles wp WHERE wp.member_id=m.id AND wp.city_id=o.city_id AND wp.enabled=1 AND wp.verified=1 AND wp.capacity=1 AND wp.min_payout_cents<=o.payout_cents AND (${detail('liveConsent')} IS NULL OR ${detail('liveConsent')} IN ('false','0') OR wp.accepts_video=1) AND EXISTS(SELECT 1 FROM worker_availability wa WHERE wa.worker_id=m.id AND wa.work_date=${detail('date')} AND wa.start_min<=CAST(substr(${detail('time')},1,2) AS INTEGER)*60+CAST(substr(${detail('time')},4,2) AS INTEGER) AND wa.end_min>=CAST(substr(${detail('time')},1,2) AS INTEGER)*60+CAST(substr(${detail('time')},4,2) AS INTEGER)+CAST(${orderHours} AS REAL)*60) AND (COALESCE(${preference('gender')},'any')='any' OR EXISTS(SELECT 1 FROM cleaner_cards cc WHERE cc.member_id=m.id AND cc.gender=${preference('gender')})) AND (${preference('fragranceFree')} IS NULL OR ${preference('fragranceFree')} IN ('false','0') OR EXISTS(SELECT 1 FROM cleaner_cards cc WHERE cc.member_id=m.id AND cc.fragrance_free=true)) AND (${preference('pets')} IS NULL OR ${preference('pets')} IN ('false','0') OR EXISTS(SELECT 1 FROM cleaner_cards cc WHERE cc.member_id=m.id AND cc.pet_friendly=true)) AND (${preference('ownProducts')} IS NULL OR ${preference('ownProducts')} IN ('false','0') OR EXISTS(SELECT 1 FROM cleaner_cards cc WHERE cc.member_id=m.id AND cc.own_products=true)) AND wp.contractor_type='npd' AND wp.npd_status=1 AND wp.npd_checked_on=? AND EXISTS (SELECT 1 FROM settings nonip WHERE nonip.key='non_ip_verification:' || wp.member_id AND ${proof('inn')}=wp.npd_inn AND LENGTH(${proof('reference')})>=10 AND LENGTH(${proof('checkedOn')})=10 AND LENGTH(${proof('verifiedBy')})>0))
 AND NOT EXISTS (SELECT 1 FROM order_skips skipped WHERE skipped.order_id=o.id AND skipped.worker_id=m.id AND skipped.snoozed_until>?)
`;
}
