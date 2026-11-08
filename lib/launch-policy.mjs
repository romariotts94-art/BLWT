// The initial launch covers personal household orders and individual NPD contractors.
export function isPersonalLaunchOrder(order) {
 return order?.personalUse === true && !['office','commercial','rental'].includes(order.service)
  && !['office','commercial','rental'].includes(order.catalogService);
}
export function hasNonIpVerification(value, inn) {
 let proof;
 try { proof = typeof value === 'string' ? JSON.parse(value) : value; } catch { return false; }
 return !!inn && proof?.inn === inn && /^\d{4}-\d{2}-\d{2}$/.test(proof.checkedOn || '')
  && typeof proof.reference === 'string' && proof.reference.trim().length >= 10
  && typeof proof.verifiedBy === 'string' && proof.verifiedBy.length > 0;
}
