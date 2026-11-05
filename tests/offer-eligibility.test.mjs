import test from 'node:test';
import assert from 'node:assert/strict';
import { offerEligibilityWhere } from '../lib/offer-eligibility.mjs';

for (const postgres of [true, false]) {
  test(`open offer eligibility uses city, shift and current contractor status (${postgres ? 'PostgreSQL' : 'SQLite'})`, () => {
    const where = offerEligibilityWhere(postgres, 'moscow-id');
    assert.match(where, /wp\.city_id=o\.city_id/);
    assert.match(where, /worker_availability wa/);
    assert.match(where, /wp\.verified=1/);
    assert.match(where, /npd_checked_on=\?/);
    assert.match(where, /ip_checked_on=\?/);
    assert.doesNotMatch(where, /wp\.services|wp\.extras/);
    assert.equal((where.match(/\?/g) || []).length, 4);
  });
}
