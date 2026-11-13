/* ==========================================================
   TABUNGAN KITA — konstanta, penyimpanan, dan utilitas
   ========================================================== */

const APP = {
  name: 'TABUNGAN KITA',
  version: 1,
  keys: { users: 'tk_users', session: 'tk_session', data: 'tk_data_' }
};

/* Kategori keuangan. "savings: true" berarti dihitung sebagai bagian total tabungan. */
const CATEGORIES = [
  { id: 'transport_car',     name: 'Transportasi mobil',      icon: '🚗',  color: '#1677FF', savings: false },
  { id: 'transport_moto',    name: 'Transportasi motor',      icon: '🏍️', color: '#7C5CFF', savings: false },
  { id: 'food',              name: 'Makanan dan minuman',     icon: '🍜',  color: '#FF8A3D', savings: false },
  { id: 'daily',             name: 'Kebutuhan sehari-hari',   icon: '🏠',  color: '#12A150', savings: false },
  { id: 'main_savings',      name: 'Tabungan utama',          icon: '💰',  color: '#0EA5C6', savings: true  },
  { id: 'vehicle_emergency', name: 'Dana darurat kendaraan',  icon: '🛠️', color: '#D99A00', savings: true  },
  { id: 'reserve',           name: 'Dana cadangan',           icon: '🛡️', color: '#2F3E9E', savings: true  },
  { id: 'other',             name: 'Keperluan lainnya',       icon: '🎯',  color: '#E5484D', savings: false }
];

/* Ikon SVG bergaya garis (gaya Lucide). */
const ICON = {
  home:    '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>',
  save:    '<circle cx="9" cy="9" r="6"/><path d="M15.5 6.5a6 6 0 1 1-6.5 9"/>',
  list:    '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  budget:  '<path d="M21 12A9 9 0 1 1 12 3v9z"/><path d="M15 3.5A9 9 0 0 1 20.5 9H15z"/>',
  user:    '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  eye:     '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff:  '<path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1"/><path d="M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.8 9.8 0 0 0 5.4-1.6"/>',
  plus:    '<path d="M12 5v14M5 12h14"/>',
  arrowIn: '<path d="M12 4v15M6 13l6 6 6-6"/>',
  arrowOut:'<path d="M12 20V5M6 11l6-6 6 6"/>',
  edit:    '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  trash:   '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 15h10l1-15"/>',
  x:       '<path d="M18 6 6 18M6 6l12 12"/>',
  logout:  '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>',
  download:'<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
  upload:  '<path d="M12 15V3M7 8l5-5 5 5M5 21h14"/>',
  wallet:  '<rect x="3" y="6" width="18" height="14" rx="3"/><path d="M3 10h18M16 15h2"/>',
  target:  '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>'
};

const LOGO_SVG = `<svg viewBox="0 0 48 48" aria-label="Logo TABUNGAN KITA" role="img">
  <rect width="48" height="48" rx="14" fill="#0A1A2F"/>
  <rect x="10" y="28" width="7" height="11" rx="2.5" fill="#8FC4FF"/>
  <rect x="20.5" y="20" width="7" height="19" rx="2.5" fill="#1677FF"/>
  <rect x="31" y="11" width="7" height="28" rx="2.5" fill="#FFFFFF"/>
</svg>`;

function icon(name) {
  if (name === 'logo') return LOGO_SVG;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name] || ''}</svg>`;
}

/* ---------- Penyimpanan (localStorage) ---------- */
const Store = {
  read(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : JSON.parse(v);
    } catch (e) {
      return fallback;
    }
  },
  write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn('Gagal menyimpan data:', e);
      return false;
    }
  },
  remove(key) {
    try { localStorage.removeItem(key); } catch (e) { /* abaikan */ }
  }
};

/* ---------- Data default ---------- */
function defaultBudget() {
  return {
    total: 120000,
    items: [
      { id: uid(), name: 'Tabungan utama',    amount: 28000 },
      { id: uid(), name: 'Bensin',            amount: 20000 },
      { id: uid(), name: 'Cadangan umum',     amount: 20000 },
      { id: uid(), name: 'Dana darurat motor', amount: 20000 }
    ]
  };
}

function defaultData() {
  // Saldo dimulai dari nol: tidak ada data keuangan contoh.
  return { transactions: [], targets: [], budget: defaultBudget() };
}

function normalizeData(d) {
  const base = defaultData();
  return {
    transactions: Array.isArray(d.transactions) ? d.transactions : base.transactions,
    targets: Array.isArray(d.targets) ? d.targets : base.targets,
    budget: d.budget && Array.isArray(d.budget.items)
      ? { total: Number(d.budget.total) || 0, items: d.budget.items }
      : base.budget
  };
}

/* ---------- Utilitas ---------- */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

/* Format Rupiah: Rp120.000 */
function rp(n) {
  const v = Math.round(Number(n) || 0);
  return (v < 0 ? '-' : '') + 'Rp' + Math.abs(v).toLocaleString('id-ID');
}

/* Ringkas untuk sumbu grafik: 150 rb, 1,2 jt */
function shortRp(v) {
  const a = Math.abs(v);
  if (a >= 1e6) return (v / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' jt';
  if (a >= 1e3) return Math.round(v / 1e3) + ' rb';
  return String(Math.round(v));
}

function parseMoney(s) {
  return Number(String(s ?? '').replace(/\D/g, '')) || 0;
}

function fmtInputNum(n) {
  return n ? Number(n).toLocaleString('id-ID') : '';
}

/* Tanggal lokal ISO: YYYY-MM-DD (tanpa geser zona waktu) */
function isoOf(d) {
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function todayISO() { return isoOf(new Date()); }

function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return isoOf(d);
}

function mondayOf(iso) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return isoOf(d);
}

function fmtDate(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
}

function fmtShort(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short'
  });
}

function monthKeyOf(iso) { return iso.slice(0, 7); }
