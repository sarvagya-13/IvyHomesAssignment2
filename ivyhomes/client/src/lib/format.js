/**
 * Indian money formatting. Prices in this dataset run from lakhs to crores,
 * so a plain toLocaleString is unreadable - nobody says "11,410,000 rupees".
 */
export const inr = (value) => {
  if (value === null || value === undefined || Number.isNaN(value)) return '--';
  const n = Number(value);
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(2).replace(/\.00$/, '')} Cr`;
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(2).replace(/\.00$/, '')} L`;
  return `${sign}₹${abs.toLocaleString('en-IN')}`;
};

export const inrExact = (value) => (value === null || value === undefined
  ? '--'
  : `₹${Number(value).toLocaleString('en-IN')}`);

export const rentPerMonth = (value) => `${inrExact(value)}/mo`;

export const sqft = (value) => (value ? `${Number(value).toLocaleString('en-IN')} sq ft` : '--');

export const titleCase = (s) => (s ?? '')
  .split(' ')
  .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
  .join(' ');

export const bhkLabel = (n, propertyType) => (propertyType === 'plot' ? 'Plot' : `${n} BHK`);

const IST = { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' };
export const postedOn = (iso) => (iso ? new Date(iso).toLocaleDateString('en-IN', IST) : '--');

export const relativeDays = (iso) => {
  if (!iso) return '';
  const days = Math.round((Date.parse('2026-09-10T00:00:00+05:30') - Date.parse(iso)) / 864e5);
  if (days < 0) return 'future-dated';
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.round(days / 30)} months ago`;
  return `${Math.round(days / 365)} years ago`;
};
