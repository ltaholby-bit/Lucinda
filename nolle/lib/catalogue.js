'use strict';
/* Nolle' Luxury Hair catalogue, taken from the three price lists
   (Raw Indian Hair, Premium Virgin Hair Collection, SDD Indian Hair).
   Prices are in rands and are "subject to confirmation" as on the lists.

   Everything starts as PRE-ORDER (“Enquire on WhatsApp”). When hair is in hand,
   switch the product to “Ready to ship” in the admin and enter the stock.

   Bundles are always sold and priced as a SET OF 3 bundles of the chosen length.
   Where a list gives a per-bundle price, the set price is 3 × that price. */

const IMG = (...names) => names.map((n) => `/static/img/brand/${n}.jpg`);
const L = (n) => `${n}"`;

/* Build variants from { optionValue: { length: price } } tables. */
function grid(optionNames, rows) {
  const variants = [];
  for (const [opts, table] of rows) {
    for (const [len, price] of Object.entries(table)) {
      if (price == null) continue;
      variants.push({ options: { ...opts, Length: L(len) }, price: Math.round(price * 100) });
    }
  }
  return { option_names: [...optionNames, 'Length'], variants };
}
const zip = (lengths, prices) => Object.fromEntries(lengths.map((l, i) => [l, prices[i]]));
const times3 = (table) => Object.fromEntries(Object.entries(table).map(([l, p]) => [l, p * 3]));
const plus = (table, add) => Object.fromEntries(Object.entries(table).map(([l, p]) => [l, p == null ? null : p + add]));
const money = (r) => 'R' + r.toLocaleString('en-ZA').replace(/,/g, ' ');
const perBundleList = (table, label = 'Single-bundle price') =>
  `## ${label}\n` + Object.entries(table).map(([l, p]) => `- ${l}": ${money(p)} per bundle`).join('\n');

const MIXED = 'Need mixed lengths (e.g. 16" / 18" / 20") or a different number of bundles? Ask us on WhatsApp for a quote.';
const PREORDER = 'Pre-order: full payment confirms your order. Delivery only – courier or PEP PAXI. Hair price only; wig making is quoted separately. Prices subject to confirmation.';

/* ---------------- Price tables ---------------- */
const RAW_SW = zip([10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34], [1237, 1455, 1672, 2193, 2583, 2779, 2996, 3257, 3495, 3908, 4342, 4776, 5102]);
const RAW_CURLY = zip([12, 14, 16, 18, 20, 22, 24, 26, 28], [1802, 2062, 2605, 2996, 3191, 3322, 3539, 3756, 4233]);
const RAW_HD_LEN = [12, 14, 16, 18, 20, 24];
const RAW_HD = {
  '5x5 HD closure': zip(RAW_HD_LEN, [1693, 1954, 2236, 2692, 2887, 5428]),
  '6x6 HD closure': zip(RAW_HD_LEN, [2019, 2388, 2670, 3148, 3452, 6101]),
  '13x4 HD frontal': zip(RAW_HD_LEN, [2649, 2866, 3126, 3408, 3712, null]),
  '13x6 HD frontal': zip(RAW_HD_LEN, [2887, 3257, 3626, 4255, 5210, 6947]),
};
const RAW_CURLY_ADD = 87;

const V_LEN = [6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30];
const V_STRAIGHT_1 = zip(V_LEN, [600, 750, 925, 1050, 1200, 1375, 1650, 2100, 2325, 2600, 2800, 3000, 3250]);
const V_CURLY_1 = zip(V_LEN, [800, 950, 1125, 1250, 1400, 1575, 1850, 2300, 2525, 2800, 3000, 3200, 3450]);
const V_CL_LEN = [10, 12, 14, 16, 18, 20];
const V_4X4 = { 'Straight / Body wave': zip(V_CL_LEN, [650, 700, 750, 850, 1100, 1250]), Curly: zip(V_CL_LEN, [700, 750, 800, 900, 1150, 1300]) };
const V_13X4 = { 'Straight / Body wave': zip(V_CL_LEN, [1050, 1150, 1225, 1450, 1750, 1950]), Curly: zip(V_CL_LEN, [1100, 1200, 1275, 1500, 1800, 2000]) };
const V_5X5 = {
  '5x5 closure': zip(V_CL_LEN, [800, 900, 1050, 1225, 1425, 1550]),
  '4x4 HD closure': zip(V_CL_LEN, [null, 1050, 1175, 1375, 1550, 1825]),
  '5x5 HD closure': zip(V_CL_LEN, [null, 1375, 1500, 1725, 1925, 2150]),
};

const SDD_1 = zip([8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28], [760, 977, 1194, 1411, 1737, 1954, 2171, 2388, 2605, 3148, 3647]);
const SDD_CARIB_ADD = 43;
const SDD_HD_LEN = [10, 12, 14, 16, 18, 20];
const SDD_HD = {
  '5x5 HD closure': zip(SDD_HD_LEN, [1476, 1693, 1910, 2128, 2345, 2779]),
  '6x6 HD closure': zip(SDD_HD_LEN, [null, 1910, 2128, 2562, 2779, 3213]),
  '13x4 HD frontal': zip(SDD_HD_LEN, [2345, 2562, 2779, 2996, 3213, 3647]),
  '13x6 HD frontal': zip(SDD_HD_LEN, [null, 2996, 3213, 3430, 3647, 4081]),
};
const pick = (obj, keys) => Object.fromEntries(keys.map((k) => [k, obj[k]]));

/* ---------------- Products ---------------- */
const base = { category: 'bundles', availability: 'enquire', colour: 'Natural colour', includes: '3 bundles of the length you choose' };

const CATALOGUE = [
  /* ---- Raw Indian Hair ---- */
  {
    ...base, slug: 'raw-indian-straight-wavy-bundles', name: 'Raw Indian Hair Bundles – Straight & Wavy', featured: 1,
    texture: 'Straight or wavy', lead_time: 'Confirmed when you order',
    short: 'Raw Indian hair in straight or wavy. Price shown is for a set of 3 bundles of the same length.',
    description: `Our Raw Indian Hair range in straight or wavy, sold as a set of three bundles.\n\n${MIXED}\n\n${perBundleList(RAW_SW)}\n\n${PREORDER}`,
    images: IMG('straight-black-styling', 'wavy-black-portrait', 'backs-five-textures'),
    ...grid(['Texture'], [[{ Texture: 'Straight' }, times3(RAW_SW)], [{ Texture: 'Wavy' }, times3(RAW_SW)]]),
  },
  {
    ...base, slug: 'raw-indian-curly-bundles', name: 'Raw Indian Hair Bundles – Curly', featured: 0,
    texture: 'Curly', lead_time: 'Confirmed when you order',
    short: 'Raw Indian curly hair. Price shown is for a set of 3 bundles of the same length.',
    description: `Our Raw Indian Hair range in curly, sold as a set of three bundles.\n\n${MIXED}\n\n${perBundleList(RAW_CURLY)}\n\n${PREORDER}`,
    images: IMG('backs-curly-and-wavy', 'duo-curly-and-wavy', 'backs-five-textures'),
    ...grid([], [[{}, times3(RAW_CURLY)]]),
  },
  {
    category: 'closures', availability: 'enquire', colour: 'Natural colour', featured: 0,
    slug: 'raw-indian-hd-closure', name: 'Raw Indian HD Lace Closure', texture: 'Straight / wavy or curly',
    lace: 'HD lace closure – 5x5 or 6x6', includes: '1 closure only (bundles not included)', lead_time: 'Confirmed when you order',
    short: 'Raw Indian hair on an HD lace closure, 5x5 or 6x6. Sold on its own.',
    description: `Raw Indian hair on HD lace for a natural-looking parting. Curly closures are R${RAW_CURLY_ADD} more per piece.\n\n${PREORDER}`,
    images: IMG('straight-black-portrait', 'trio-straight'),
    ...grid(['Size', 'Texture'], ['5x5 HD closure', '6x6 HD closure'].flatMap((size) => [
      [{ Size: size, Texture: 'Straight / Wavy' }, RAW_HD[size]],
      [{ Size: size, Texture: 'Curly' }, plus(RAW_HD[size], RAW_CURLY_ADD)],
    ])),
  },
  {
    category: 'closures', availability: 'enquire', colour: 'Natural colour', featured: 1,
    slug: 'raw-indian-hd-frontal', name: 'Raw Indian HD Lace Frontal', texture: 'Straight / wavy or curly',
    lace: 'HD lace frontal – 13x4 or 13x6', includes: '1 frontal only (bundles not included)', lead_time: 'Confirmed when you order',
    short: 'Raw Indian hair on an HD lace frontal, 13x4 or 13x6. Sold on its own.',
    description: `Ear-to-ear HD lace frontal in Raw Indian hair for a seamless hairline. Curly frontals are R${RAW_CURLY_ADD} more per piece.\n\n${PREORDER}`,
    images: IMG('trio-profiles', 'straight-black-portrait'),
    ...grid(['Size', 'Texture'], ['13x4 HD frontal', '13x6 HD frontal'].flatMap((size) => [
      [{ Size: size, Texture: 'Straight / Wavy' }, RAW_HD[size]],
      [{ Size: size, Texture: 'Curly' }, plus(RAW_HD[size], RAW_CURLY_ADD)],
    ])),
  },

  /* ---- Premium Virgin Hair Collection ---- */
  {
    ...base, slug: 'virgin-straight-bundles', name: 'Premium Virgin Hair Bundles – Straight', featured: 0,
    texture: 'Straight', lead_time: '7–10 working days, plus delivery',
    short: 'Premium virgin straight hair. Price shown is for a set of 3 bundles of the same length.',
    description: `From our Premium Virgin Hair Collection, sold as a set of three bundles.\n\n${MIXED}\n\n${perBundleList(V_STRAIGHT_1)}\n\n${PREORDER}`,
    images: IMG('straight-black-portrait', 'backs-five-textures', 'trio-straight'),
    ...grid([], [[{}, times3(V_STRAIGHT_1)]]),
  },
  {
    ...base, slug: 'virgin-curly-bundles', name: 'Premium Virgin Hair Bundles – Curly', featured: 1,
    texture: 'Curly', lead_time: '7–10 working days, plus delivery',
    short: 'Premium virgin curly hair. Price shown is for a set of 3 bundles of the same length.',
    description: `From our Premium Virgin Hair Collection, sold as a set of three bundles.\n\n${MIXED}\n\n${perBundleList(V_CURLY_1)}\n\n${PREORDER}`,
    images: IMG('duo-curly-and-wavy', 'backs-curly-and-wavy'),
    ...grid([], [[{}, times3(V_CURLY_1)]]),
  },
  {
    category: 'closures', availability: 'enquire', colour: 'Natural colour', featured: 0,
    slug: 'virgin-4x4-closure', name: 'Premium Virgin 4x4 Lace Closure', texture: 'Straight / body wave or curly',
    lace: '4x4 lace closure', includes: '1 closure only (bundles not included)', lead_time: '7–10 working days, plus delivery',
    short: 'Premium virgin hair on a 4x4 lace closure. Sold on its own.',
    description: `A 4x4 lace closure from our Premium Virgin Hair Collection.\n\n${PREORDER}`,
    images: IMG('wavy-black-portrait', 'straight-black-portrait'),
    ...grid(['Texture'], Object.entries(V_4X4).map(([t, table]) => [{ Texture: t }, table])),
  },
  {
    category: 'closures', availability: 'enquire', colour: 'Natural colour', featured: 0,
    slug: 'virgin-13x4-frontal', name: 'Premium Virgin 13x4 Lace Frontal', texture: 'Straight / body wave or curly',
    lace: '13x4 lace frontal', includes: '1 frontal only (bundles not included)', lead_time: '7–10 working days, plus delivery',
    short: 'Premium virgin hair on a 13x4 lace frontal. Sold on its own.',
    description: `A 13x4 ear-to-ear lace frontal from our Premium Virgin Hair Collection.\n\n${PREORDER}`,
    images: IMG('trio-straight', 'trio-profiles'),
    ...grid(['Texture'], Object.entries(V_13X4).map(([t, table]) => [{ Texture: t }, table])),
  },
  {
    category: 'closures', availability: 'enquire', colour: 'Natural colour', featured: 0,
    slug: 'virgin-5x5-hd-closures', name: 'Premium Virgin 5x5 & HD Closures', texture: 'Straight',
    lace: '5x5 lace, 4x4 HD lace or 5x5 HD lace closure', includes: '1 closure only (bundles not included)', lead_time: '7–10 working days, plus delivery',
    short: 'Premium virgin closures in 5x5, 4x4 HD or 5x5 HD lace. Sold on their own.',
    description: `Choose standard 5x5 lace, or HD lace for an even more invisible finish.\n\n${PREORDER}`,
    images: IMG('straight-black-styling', 'trio-smiling'),
    ...grid(['Size'], Object.entries(V_5X5).map(([size, table]) => [{ Size: size }, table])),
  },

  /* ---- SDD Indian Hair ---- */
  {
    ...base, slug: 'sdd-indian-bundles', name: 'SDD Indian Hair Bundles', featured: 1,
    texture: 'Straight, bouncy curl or Caribbean curl', lead_time: 'Confirmed when you order',
    short: 'SDD Indian hair in straight, bouncy curl or Caribbean curl. Price shown is for a set of 3 bundles of the same length.',
    description: `SDD Indian Hair, sold as a set of three bundles. Caribbean Curl is R${SDD_CARIB_ADD} more per bundle.\n\n${MIXED}\n\n${perBundleList(SDD_1, 'Single-bundle price (straight & bouncy curl)')}\n\n${PREORDER}`,
    images: IMG('group-lineup', 'straight-black-styling', 'wavy-black-portrait'),
    ...grid(['Texture'], [
      [{ Texture: 'Straight' }, times3(SDD_1)],
      [{ Texture: 'Bouncy curl' }, times3(SDD_1)],
      [{ Texture: 'Caribbean curl' }, times3(plus(SDD_1, SDD_CARIB_ADD))],
    ]),
  },
  {
    category: 'closures', availability: 'enquire', colour: 'Natural colour', featured: 0,
    slug: 'sdd-indian-hd-closure', name: 'SDD Indian HD Lace Closure', texture: 'Straight or bouncy curl',
    lace: 'HD lace closure – 5x5 or 6x6', includes: '1 closure only (bundles not included)', lead_time: 'Confirmed when you order',
    short: 'SDD Indian hair on an HD lace closure, 5x5 or 6x6. Sold on its own.',
    description: `HD lace closure to match our SDD Indian bundles.\n\n${PREORDER}`,
    images: IMG('trio-laughing', 'straight-black-portrait'),
    ...grid(['Size'], Object.entries(pick(SDD_HD, ['5x5 HD closure', '6x6 HD closure'])).map(([size, table]) => [{ Size: size }, table])),
  },
  {
    category: 'closures', availability: 'enquire', colour: 'Natural colour', featured: 0,
    slug: 'sdd-indian-hd-frontal', name: 'SDD Indian HD Lace Frontal', texture: 'Straight or bouncy curl',
    lace: 'HD lace frontal – 13x4 or 13x6', includes: '1 frontal only (bundles not included)', lead_time: 'Confirmed when you order',
    short: 'SDD Indian hair on an HD lace frontal, 13x4 or 13x6. Sold on its own.',
    description: `HD lace frontal to match our SDD Indian bundles.\n\n${PREORDER}`,
    images: IMG('trio-smiling', 'trio-profiles'),
    ...grid(['Size'], Object.entries(pick(SDD_HD, ['13x4 HD frontal', '13x6 HD frontal'])).map(([size, table]) => [{ Size: size }, table])),
  },
];

module.exports = { CATALOGUE };
