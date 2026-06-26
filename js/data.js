// ============================================================
//  data.js — Student-friendly MMU Melaka content for Skibidi GoFood
// ============================================================

const SGF_DEFAULT_AVATAR = 'images/user-avatar.webp';

function SGFImagePath(src, fallback = '') {
  const raw = String(src || '').trim();
  const backup = String(fallback || '').trim();
  const value = raw || backup;
  if (!value) return '';
  // Only allow safe image sources. Reject executable/data URLs that can break UI or
  // create unsafe admin-entered catalog records. Keep data:image for user avatars.
  if (/^(javascript|vbscript|file|blob):/i.test(value) || (/^data:/i.test(value) && !/^data:image\//i.test(value))) {
    return backup && backup !== raw ? SGFImagePath(backup, '') : '';
  }
  if (/^data:image\//i.test(value) || /^(https?:)?\/\//i.test(value)) return value;
  return value
    .replace(/-100(?:%25|%)?\.webp(?=([?#]|$))/i, '.webp')
    .replace(/\.(?:png|svg|jpe?g|gif)(?=([?#]|$))/i, '.webp');
}

if (typeof window !== 'undefined') {
  window.SGF_DEFAULT_AVATAR = SGF_DEFAULT_AVATAR;
  window.SGFImagePath = SGFImagePath;
}

const BRANDS = [
  { id:'mcdo', name:"McDonald's",  tag:'Fast Food',     logo:'images/mcdo.webp',  special:"Big Mac Meal — RM 12.90" },
  { id:'kfc',  name:'KFC',         tag:'Fried Chicken', logo:'images/kfc.webp',   special:"Zinger Burger Set — RM 11.90" },
  { id:'bk',   name:'Burger King', tag:'Burgers',       logo:'images/bk.webp',    special:"Whopper Combo — RM 13.90" },
  { id:'ph',   name:'Pizza Hut',   tag:'Pizza',         logo:'images/ph.webp',    special:"Personal Pan Pizza — RM 10.90" },
  { id:'sw',   name:'Subway',      tag:'Sandwiches',    logo:'images/sw.webp',    special:"6-inch Sub Meal — RM 9.90" },
  { id:'dm',   name:"Domino's",    tag:'Pizza',         logo:'images/dm.webp',    special:"Regular Pizza — RM 12.90" },
  { id:'tb',   name:'Taco Bell',   tag:'Mexican',       logo:'images/tb.webp',    special:"Crunchy Taco Box — RM 14.90" },
  { id:'pz',   name:'Popeyes',     tag:'Fried Chicken', logo:'images/pz.webp',    special:"Check current outlet coverage before ordering" },
];

// popularity: 1–100 (used for Hot & Popular ranking)
const FOODS = [
  // ── McDonald's ──────────────────────────────────────────────
  { id:1,  brand:'mcdo', bName:"McDonald's", bLogo:'images/mcdo.webp', img:'images/mcdo-bigmac.webp',    name:'Big Mac',             cat:'fast food', price:9.90, pts:10, badge:'FAMOUS', popularity:98 },
  { id:2,  brand:'mcdo', bName:"McDonald's", bLogo:'images/mcdo.webp', img:'images/mcdo-fries.webp',     name:'McFries Large',       cat:'fast food', price:4.50,  pts:5,  badge:null,     popularity:85 },
  { id:3,  brand:'mcdo', bName:"McDonald's", bLogo:'images/mcdo.webp', img:'images/mcdo-mcflurry.webp',  name:'McFlurry Oreo',       cat:'dessert',   price:6.50,  pts:7,  badge:'NEW',    popularity:72 },
  { id:4,  brand:'mcdo', bName:"McDonald's", bLogo:'images/mcdo.webp', img:'images/mcdo-latte.webp',     name:'McCafé Iced Latte',   cat:'drinks',    price:6.90,  pts:7, badge:'NEW',    popularity:60 },
  { id:5,  brand:'mcdo', bName:"McDonald's", bLogo:'images/mcdo.webp', img:'images/mcdo-sundae.webp',    name:'Sundae Cone',         cat:'dessert',   price:3.50,  pts:4,  badge:null,     popularity:55 },
  // ── KFC ─────────────────────────────────────────────────────
  { id:6,  brand:'kfc',  bName:'KFC',        bLogo:'images/kfc.webp',  img:'images/kfc-zinger.webp',     name:'Zinger Burger',       cat:'fast food', price:9.50, pts:10, badge:'HOT',    popularity:95 },
  { id:7,  brand:'kfc',  bName:'KFC',        bLogo:'images/kfc.webp',  img:'images/kfc-chicken.webp',    name:'3-pc Chicken',        cat:'fast food', price:11.90, pts:12, badge:'FAMOUS', popularity:93 },
  { id:8,  brand:'kfc',  bName:'KFC',        bLogo:'images/kfc.webp',  img:'images/kfc-coleslaw.webp',   name:'Coleslaw + Corn',     cat:'fast food', price:5.00,  pts:5,  badge:null,     popularity:45 },
  { id:9,  brand:'kfc',  bName:'KFC',        bLogo:'images/kfc.webp',  img:'images/kfc-pepsi.webp',      name:'Pepsi Regular',       cat:'drinks',    price:2.90,  pts:3,  badge:null,     popularity:40 },
  // ── Burger King ──────────────────────────────────────────────
  { id:10, brand:'bk',   bName:'Burger King', bLogo:'images/bk.webp',  img:'images/bk-whopper.webp',     name:'Whopper',             cat:'fast food', price:10.90, pts:11, badge:'FAMOUS', popularity:96 },
  { id:11, brand:'bk',   bName:'Burger King', bLogo:'images/bk.webp',  img:'images/bk-onionrings.webp',  name:'Onion Rings',         cat:'fast food', price:4.50,  pts:5,  badge:null,     popularity:68 },
  { id:12, brand:'bk',   bName:'Burger King', bLogo:'images/bk.webp',  img:'images/bk-sundae.webp',      name:'BK Sundae',           cat:'dessert',   price:5.20,  pts:5,  badge:null,     popularity:52 },
  // ── Pizza Hut ────────────────────────────────────────────────
  { id:13, brand:'ph',   bName:'Pizza Hut',   bLogo:'images/ph.webp',  img:'images/ph-pizza.webp',       name:'Pepperoni Pan Pizza', cat:'pizza',     price:16.90, pts:17, badge:'HOT',    popularity:91 },
  { id:14, brand:'ph',   bName:'Pizza Hut',   bLogo:'images/ph.webp',  img:'images/ph-breadsticks.webp', name:'Garlic Breadsticks',  cat:'fast food', price:6.50,  pts:7,  badge:null,     popularity:63 },
  { id:15, brand:'ph',   bName:'Pizza Hut',   bLogo:'images/ph.webp',  img:'images/ph-pitcher.webp',     name:'Pepsi Pitcher',       cat:'drinks',    price:8.50, pts:9, badge:null,     popularity:42 },
  // ── Subway ───────────────────────────────────────────────────
  { id:16, brand:'sw',   bName:'Subway',      bLogo:'images/sw.webp',  img:'images/sw-sub.webp',         name:'Chicken Teriyaki Sub',cat:'fast food', price:11.90, pts:12, badge:'NEW',    popularity:78 },
  { id:17, brand:'sw',   bName:'Subway',      bLogo:'images/sw.webp',  img:'images/sw-salad.webp',       name:'Garden Fresh Salad',  cat:'fast food', price:8.90, pts:9, badge:null,     popularity:50 },
  { id:18, brand:'sw',   bName:'Subway',      bLogo:'images/sw.webp',  img:'images/sw-tea.webp',         name:'Iced Peach Tea',      cat:'drinks',    price:4.50,  pts:5,  badge:null,     popularity:46 },
  // ── Domino's ─────────────────────────────────────────────────
  { id:19, brand:'dm',   bName:"Domino's",    bLogo:'images/dm.webp',  img:'images/dm-bbqpizza.webp',    name:'BBQ Chicken Pizza',   cat:'pizza',     price:18.50, pts:19, badge:'FAMOUS', popularity:90 },
  { id:20, brand:'dm',   bName:"Domino's",    bLogo:'images/dm.webp',  img:'images/dm-margherita.webp',  name:'Margherita Pizza',    cat:'pizza',     price:14.50, pts:15, badge:null,     popularity:70 },
  { id:21, brand:'dm',   bName:"Domino's",    bLogo:'images/dm.webp',  img:'images/dm-garlicbread.webp', name:'Cheesy Garlic Bread', cat:'fast food', price:7.20,  pts:7, badge:null,     popularity:65 },
  // ── Taco Bell ────────────────────────────────────────────────
  { id:22, brand:'tb',   bName:'Taco Bell',   bLogo:'images/tb.webp',  img:'images/tb-taco.webp',        name:'Crunchy Beef Taco',   cat:'fast food', price:5.90,  pts:6,  badge:'HOT',    popularity:82 },
  { id:23, brand:'tb',   bName:'Taco Bell',   bLogo:'images/tb.webp',  img:'images/tb-chalupa.webp',     name:'Chalupa Supreme',     cat:'fast food', price:8.90, pts:9, badge:null,     popularity:66 },
  { id:24, brand:'tb',   bName:'Taco Bell',   bLogo:'images/tb.webp',  img:'images/tb-bajaBlast.webp',   name:'Baja Blast Freeze',   cat:'drinks',    price:6.50,  pts:7,  badge:'NEW',    popularity:75 },
  // ── Popeyes ──────────────────────────────────────────────────
  { id:25, brand:'pz',   bName:'Popeyes',     bLogo:'images/pz.webp',  img:'images/pz-sandwich.webp',    name:'Popeyes Sandwich',    cat:'fast food', price:11.50, pts:12, badge:'HOT',    popularity:94 },
  { id:26, brand:'pz',   bName:'Popeyes',     bLogo:'images/pz.webp',  img:'images/pz-tenders.webp',     name:'3-pc Tenders',        cat:'fast food', price:12.90, pts:13, badge:null,     popularity:80 },
  { id:27, brand:'pz',   bName:'Popeyes',     bLogo:'images/pz.webp',  img:'images/pz-biscuit.webp',     name:'Buttermilk Biscuit',  cat:'fast food', price:3.20,  pts:3,  badge:null,     popularity:58 },
  { id:28, brand:'pz',   bName:'Popeyes',     bLogo:'images/pz.webp',  img:'images/pz-lemonade.webp',    name:'Lemonade',            cat:'drinks',    price:4.90,  pts:5,  badge:null,     popularity:48 },
];

/** Top items by popularity — used for Hot & Popular section */
const HOT_POPULAR = FOODS
  .filter(f => f.popularity >= 80)
  .sort((a, b) => b.popularity - a.popularity);

const REWARDS_DATA = [
  { icon:'🥤', title:'Free Drink Voucher',   desc:'A free drink on your next order when you need a low-cost study boost.',                                  pts:70,  vid:'DRINK_FREE',  vlabel:'Free Drink' },
  { icon:'🍔', title:'Free Burger Voucher',  desc:'Get one burger from any brand for free and stretch your student budget further.',                          pts:180, vid:'BURGER_FREE', vlabel:'Free Burger' },
  { icon:'🏷️', title:'10% Off Voucher',     desc:'10% discount on your whole cart total. Maximum saving: RM 6.',                                            pts:120, vid:'DISC_10',     vlabel:'10% Discount' },
  { icon:'💰', title:'RM 5 Off Voucher',     desc:'Flat RM 5 off your total bill. Great for quick student meals and wallet payments.',                       pts:140, vid:'RM5_OFF',     vlabel:'RM 5 Off' },
  { icon:'👑', title:'Double Points Booster',desc:'Earn 2× loyalty points on your very next order and redeem rewards sooner.',                               pts:220, vid:'DBL_PTS',     vlabel:'2x Points' },
  { icon:'🎁', title:'Mystery Gift',         desc:'A surprise discount voucher worth 5% to 12% off your next order. The exact rate appears at checkout.',   pts:130, vid:'MYSTERY',     vlabel:'Mystery Gift' },
];

const SPIN_PRIZES = [
  { label:'Points Reward', sub:'Win 30 – 150 pts',     color:'#e74c3c', odds:'27%' },
  { label:'Nothing',       sub:'Better luck next time', color:'#fed330', odds:'72%'  },
  { label:'Mystery Gift',  sub:'Rare bonus — 120 to 220 pts',   color:'#27ae60', odds:'1%' },
];

const REVIEWS = [
  { img:'images/user-1.webp', name:'Ahmad Rizz',   stars:5,   text:'Finally a food app that feels built for MMU Melaka students. Prices look much more realistic for daily meals.' },
  { img:'images/user-2.webp', name:'Nur Aisha',    stars:5,   text:"Super fast delivery to hostel and the burger still arrived hot. The smaller wallet top-ups help a lot too!" },
  { img:'images/user-3.webp', name:'Hafiz WR',     stars:4.5, text:'Love having different brands in one app without the prices feeling too heavy for student life.' },
  { img:'images/user-4.webp', name:'Siti GoFood',  stars:5,   text:'The voucher worked instantly at checkout and helped me save on a late-night study meal.' },
  { img:'images/user-5.webp', name:'Zack Sigma',   stars:4.5, text:'Top-up is easy, rewards are fair, and the menu feels tuned to what students can actually afford.' },
  { img:'images/user-6.webp', name:'Daniel MMU',   stars:5,   text:'Great for class breaks and hostel dinners. Fast, simple, and way more budget-friendly than before.' },
];

const CATEGORIES = [
  { id:'all',       label:'All Items', img:'images/cat-all.webp'      },
  { id:'fast food', label:'Fast Food', img:'images/cat-fastfood.webp' },
  { id:'pizza',     label:'Pizza',     img:'images/cat-pizza.webp'    },
  { id:'drinks',    label:'Drinks',    img:'images/cat-drinks.webp'   },
  { id:'dessert',   label:'Desserts',  img:'images/cat-dessert.webp'  },
];

// ============================================================
//  Extended marketplace metadata for restaurant filters,
//  delivery management, reviews, FAQ, and customisations
// ============================================================

const BRAND_DETAILS = {
  mcdo: { cuisine: 'Fast Food',          location: '4570 Jalan Tun Abdul Razak, 75450 Ayer Keroh, Melaka',   rating: 4.8, priceLevel: '$',  eta: '15-25 min', minOrder: 6 },
  kfc:  { cuisine: 'Fried Chicken',      location: 'Lot G12, Ground Floor, AEON Melaka, Lebuh Ayer Keroh, 75450 Ayer Keroh, Melaka', rating: 4.7, priceLevel: '$',  eta: '15-25 min', minOrder: 6 },
  bk:   { cuisine: 'Burgers',            location: 'Lot G05, AEON Melaka, Lebuh Ayer Keroh, 75450 Ayer Keroh, Melaka',    rating: 4.6, priceLevel: '$',  eta: '18-28 min', minOrder: 6 },
  ph:   { cuisine: 'Pizza',              location: 'No. 1 Ground Floor, Jalan BBP 1, Taman Batu Berendam Putra, 75350 Batu Berendam, Melaka', rating: 4.5, priceLevel: '$$', eta: '20-30 min', minOrder: 8 },
  sw:   { cuisine: 'Healthy Sandwiches', location: 'G01, Mydin MITC Melaka, MITC, 75450 Ayer Keroh, Melaka',          rating: 4.6, priceLevel: '$',  eta: '15-25 min', minOrder: 6 },
  dm:   { cuisine: 'Pizza',              location: 'No. 1, 1-1 & 1-2, Jalan MP 1, Taman Merdeka Permai, 75350 Batu Berendam, Melaka',     rating: 4.4, priceLevel: '$$', eta: '20-30 min', minOrder: 8 },
  tb:   { cuisine: 'Mexican',            location: 'Lot G53, AEON Mall Bandaraya Melaka, 2 Jalan Lagenda 2, Taman 1 Lagenda, 75400 Melaka',         rating: 4.5, priceLevel: '$',  eta: '18-28 min', minOrder: 6 },
  pz:   { cuisine: 'Fried Chicken',      location: 'Outlet coverage varies by city. Please confirm availability before ordering.',   rating: 4.7, priceLevel: '$',  eta: '18-28 min', minOrder: 6 },
};

BRANDS.forEach((brand) => Object.assign(brand, BRAND_DETAILS[brand.id] || {}));

const CUSTOMIZATION_LIBRARY = {
  'fast food': {
    sizes: [
      { label: 'Regular', price: 0 },
      { label: 'Large', price: 1.5 },
      { label: 'Combo Set', price: 3.5 },
    ],
    spice: ['Original', 'Mild', 'Spicy'],
    addons: [
      { label: 'Extra Cheese', price: 1.0 },
      { label: 'Add Fries', price: 2.0 },
      { label: 'Add Drink', price: 1.5 },
    ],
  },
  pizza: {
    sizes: [
      { label: 'Personal', price: 0 },
      { label: 'Regular', price: 4.0 },
      { label: 'Large', price: 7.5 },
    ],
    spice: ['Classic', 'Chilli Flakes', 'Extra Spicy'],
    addons: [
      { label: 'Cheese Burst', price: 3.0 },
      { label: 'Extra Sauce', price: 1.0 },
      { label: 'Garlic Dip', price: 1.2 },
    ],
  },
  drinks: {
    sizes: [
      { label: 'Small', price: 0 },
      { label: 'Medium', price: 1.0 },
      { label: 'Large', price: 2.0 },
    ],
    spice: ['Regular Ice', 'Less Ice', 'No Ice'],
    addons: [
      { label: 'Extra Shot', price: 1.5 },
      { label: 'Whipped Cream', price: 1.0 },
      { label: 'Boba Pearls', price: 1.5 },
    ],
  },
  dessert: {
    sizes: [
      { label: 'Regular', price: 0 },
      { label: 'Large', price: 1.2 },
    ],
    spice: ['Normal', 'Less Sweet', 'Extra Sweet'],
    addons: [
      { label: 'Chocolate Sauce', price: 0.8 },
      { label: 'Cookie Crumbs', price: 1.0 },
      { label: 'Vanilla Scoop', price: 1.5 },
    ],
  },
};

FOODS.forEach((food, index) => {
  food.rating = Number((4.2 + ((food.popularity || 50) / 100) * 0.8).toFixed(1));
  food.priceLevel = food.price >= 20 ? '$$$' : (food.price >= 10 ? '$$' : '$');
  food.customization = CUSTOMIZATION_LIBRARY[food.cat] || CUSTOMIZATION_LIBRARY['fast food'];
  food.isActive = food.isActive !== false;
  food.sortOrder = index + 1;
});

const DEFAULT_DRIVERS = [
  { id: 'DRV-01', name: 'Azlan', phone: '+60123456780', vehicle: 'Honda Wave',    zone: 'Bukit Beruang' },
  { id: 'DRV-02', name: 'Mira',  phone: '+60123456781', vehicle: 'Yamaha Ego',    zone: 'Ayer Keroh' },
  { id: 'DRV-03', name: 'Hafiz', phone: '+60123456782', vehicle: 'Perodua Bezza', zone: 'MITC' },
  { id: 'DRV-04', name: 'Nadia', phone: '+60123456783', vehicle: 'Honda City',    zone: 'Melaka Raya' },
];

const DEFAULT_FAQS = [
  {
    q: 'How long does delivery usually take?',
    a: 'Delivery timing depends on distance, weather, traffic, and kitchen load. Check the live order status for the clearest estimate shown for your order.',
  },
  {
    q: 'Can I customise my food before checkout?',
    a: 'Yes. Open the quick-view panel from the menu or home page to pick size, spice level, and low-cost add-ons before you add the food to cart.',
  },
  {
    q: 'What happens when my order is cancelled by admin?',
    a: 'For prepaid orders, the amount is automatically refunded to your in-app wallet once the order is cancelled. Cash on delivery orders do not need a refund.',
  },
  {
    q: 'How do loyalty points and vouchers work?',
    a: 'You earn points after each order is delivered successfully. Use those points on the rewards page to redeem student-friendly vouchers, spins, and discount perks for future orders.',
  },
];
