/* ==========================================================
   TABUNGAN KITA — logika utama aplikasi
   ========================================================== */

const state = {
  user: null,
  name: '',
  data: null,
  view: 'home',
  txMonth: monthKeyOf(todayISO()),   // null = tampilkan semua bulan
  savingsRange: 'monthly',
  charts: {}
};

const $ = sel => document.querySelector(sel);

/* ---------- Data per pengguna ---------- */
function loadData(username) {
  const raw = Store.read(APP.keys.data + username, null);
  return raw ? normalizeData(raw) : defaultData();
}

function saveData() {
  if (!state.user) return;
  const ok = Store.write(APP.keys.data + state.user, state.data);
  if (!ok) showToast('Gagal menyimpan. Penyimpanan browser penuh?');
}

/* ---------- Turunan data ---------- */
const catById = id => CATEGORIES.find(c => c.id === id) || CATEGORIES[CATEGORIES.length - 1];
const isSavingsCat = id => !!(CATEGORIES.find(c => c.id === id) || {}).savings;
const signed = t => (t.type === 'in' ? t.amount : -t.amount);
const sortTx = (a, b) => b.date.localeCompare(a.date) || (b.created || 0) - (a.created || 0);

function totals(txs) {
  const masuk = txs.filter(t => t.type === 'in').reduce((s, t) => s + t.amount, 0);
  const keluar = txs.filter(t => t.type === 'out').reduce((s, t) => s + t.amount, 0);
  const tabungan = txs.filter(t => isSavingsCat(t.categoryId)).reduce((s, t) => s + signed(t), 0);
  return { masuk, keluar, saldo: masuk - keluar, tabungan };
}

const catBalance = (txs, id) => txs.filter(t => t.categoryId === id).reduce((s, t) => s + signed(t), 0);

/* Deret waktu tabungan: periode weekly (12 minggu), monthly (12 bulan), yearly (5 tahun) */
function bucketDefs(range) {
  const now = new Date();
  if (range === 'weekly') {
    const base = mondayOf(todayISO());
    const keys = [];
    for (let i = 11; i >= 0; i--) keys.push(addDays(base, -7 * i));
    return {
      keys,
      label: k => fmtShort(k),
      keyOf: d => mondayOf(d)
    };
  }
  if (range === 'yearly') {
    const keys = [];
    for (let i = 4; i >= 0; i--) keys.push(String(now.getFullYear() - i));
    return { keys, label: k => k, keyOf: d => d.slice(0, 4) };
  }
  const keys = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
  }
  return {
    keys,
    label: k => {
      const [y, m] = k.split('-');
      return new Date(+y, +m - 1, 1).toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });
    },
    keyOf: d => d.slice(0, 7)
  };
}

function savingsSeries(range, cumulative) {
  const def = bucketDefs(range);
  const first = def.keys[0];
  const sums = {};
  def.keys.forEach(k => { sums[k] = 0; });
  let base = 0;
  state.data.transactions.forEach(t => {
    if (!isSavingsCat(t.categoryId)) return;
    const k = def.keyOf(t.date);
    const v = signed(t);
    if (k < first) base += v;
    else if (Object.prototype.hasOwnProperty.call(sums, k)) sums[k] += v;
  });
  let run = base;
  const values = def.keys.map(k => (cumulative ? (run += sums[k]) : sums[k]));
  return { labels: def.keys.map(def.label), values };
}

/* Estimasi waktu mencapai target berdasarkan setoran bersih 90 hari terakhir */
function estimateTarget(t, bal) {
  const remaining = t.target - bal;
  if (remaining <= 0) return { done: true, text: 'Target tercapai 🎉' };
  const today = todayISO();
  const since = addDays(today, -90);
  const net = state.data.transactions
    .filter(x => x.categoryId === t.categoryId && x.date >= since && x.date <= today)
    .reduce((s, x) => s + signed(x), 0);
  if (net <= 0) return { done: false, text: 'Belum ada setoran 90 hari terakhir' };
  const days = Math.ceil(remaining / (net / 90));
  const eta = addDays(today, days);
  let dur;
  if (days <= 14) dur = days + ' hari';
  else if (days <= 60) dur = Math.ceil(days / 7) + ' minggu';
  else dur = Math.ceil(days / 30) + ' bulan';
  return { done: false, text: '± ' + dur + ' (sekitar ' + fmtShort(eta) + ')' };
}

/* ---------- Grafik ---------- */
function drawChart(id, labels, values, kind) {
  const el = document.getElementById(id);
  if (!el) return;
  if (state.charts[id]) { state.charts[id].destroy(); delete state.charts[id]; }
  if (typeof Chart === 'undefined') {
    el.parentElement.innerHTML = '<div class="empty">Grafik memerlukan koneksi internet untuk memuat Chart.js.</div>';
    return;
  }
  const isLine = kind === 'line';
  state.charts[id] = new Chart(el, {
    type: isLine ? 'line' : 'bar',
    data: {
      labels,
      datasets: [{
        data: values,
        borderColor: '#1677FF',
        backgroundColor: isLine ? 'rgba(22,119,255,.12)' : '#1677FF',
        fill: isLine,
        tension: .35,
        borderWidth: 2.5,
        borderRadius: 8,
        maxBarThickness: 26,
        pointRadius: 3,
        pointBackgroundColor: '#1677FF'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: c => rp(c.parsed.y) } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#6B7A90', maxRotation: 0, autoSkip: true } },
        y: { grid: { color: '#EEF2F7' }, ticks: { color: '#6B7A90', callback: v => shortRp(v) } }
      }
    }
  });
}

/* ---------- Komponen tampilan ---------- */
function txRow(t, actions = true) {
  const c = catById(t.categoryId);
  return `
  <div class="tx">
    <span class="cat-ico" style="background:${c.color}1F">${c.icon}</span>
    <div class="main">
      <div class="title">${esc(t.note || c.name)}</div>
      <div class="sub">${esc(c.name)} · ${fmtShort(t.date)}</div>
    </div>
    <div class="side">
      <div class="amt ${t.type}">${t.type === 'in' ? '+' : '-'}${rp(t.amount)}</div>
      ${actions ? `
      <div class="row-actions">
        <button class="icon-btn" data-action="edit-tx" data-id="${t.id}" aria-label="Edit transaksi">${icon('edit')}</button>
        <button class="icon-btn danger" data-action="del-tx" data-id="${t.id}" aria-label="Hapus transaksi">${icon('trash')}</button>
      </div>` : ''}
    </div>
  </div>`;
}

function statCard(label, iconName, value, cls = '') {
  return `
  <div class="stat">
    <div class="k">${icon(iconName)} ${label}</div>
    <div class="v ${cls}">${value}</div>
  </div>`;
}

/* ---------- Navigasi & render ---------- */
function setView(name) {
  state.view = name;
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('hidden', v.dataset.view !== name));
  document.querySelectorAll('[data-nav]').forEach(b => b.classList.toggle('active', b.dataset.nav === name));
  renderView(name);
  window.scrollTo(0, 0);
}

function renderView(name) {
  const map = {
    home: renderHome,
    tabungan: renderSavings,
    transaksi: renderTx,
    anggaran: renderBudget,
    profil: renderProfile
  };
  if (map[name]) map[name]();
}

function refresh() { renderView(state.view); }

function renderHome() {
  const txs = state.data.transactions;
  const t = totals(txs);
  const h = new Date().getHours();
  const greet = h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam';
  const recent = [...txs].sort(sortTx).slice(0, 5);

  $('#view-home').innerHTML = `
    <p class="muted">${greet},</p>
    <h2 class="hello">${esc(state.name)}</h2>

    <div class="hero">
      <div class="label">Total seluruh tabungan</div>
      <div class="amount">${rp(t.tabungan)}</div>
      <div class="hero-actions">
        <button class="btn btn-solid" data-action="add-in">${icon('arrowIn')} Tambah Pemasukan</button>
        <button class="btn" data-action="add-out">${icon('arrowOut')} Tambah Pengeluaran</button>
      </div>
    </div>

    <div class="stats">
      ${statCard('Total uang masuk', 'arrowIn', rp(t.masuk), 'dot-in')}
      ${statCard('Total uang keluar', 'arrowOut', rp(t.keluar), 'dot-out')}
      ${statCard('Saldo tersedia', 'wallet', rp(t.saldo))}
      ${statCard('Jumlah transaksi', 'list', txs.length + ' transaksi')}
    </div>

    <section class="section">
      <div class="card">
        <div class="section-head">
          <h3>Perkembangan tabungan</h3>
          <span class="pill">12 bulan</span>
        </div>
        <div class="chart-box"><canvas id="chart-home" aria-label="Grafik perkembangan tabungan"></canvas></div>
      </div>
    </section>

    <section class="section">
      <div class="section-head"><h3>Kategori keuangan</h3></div>
      <div class="cat-grid">
        ${CATEGORIES.map(c => {
          const bal = catBalance(txs, c.id);
          const n = txs.filter(x => x.categoryId === c.id).length;
          return `
          <button class="cat-card" data-action="cat" data-id="${c.id}" aria-label="Lihat riwayat ${esc(c.name)}">
            <div class="row-between">
              <span class="cat-ico" style="background:${c.color}1F">${c.icon}</span>
              <span class="pill">${c.savings ? 'Tabungan' : 'Umum'}</span>
            </div>
            <div>
              <div class="name">${esc(c.name)}</div>
              <div class="bal" style="color:${bal < 0 ? 'var(--red)' : c.color}">${rp(bal)}</div>
              <div class="meta">${n} transaksi</div>
            </div>
          </button>`;
        }).join('')}
      </div>
    </section>

    <section class="section">
      <div class="section-head">
        <h3>Riwayat transaksi terbaru</h3>
        <button class="btn btn-ghost btn-sm" data-nav="transaksi">Lihat semua</button>
      </div>
      <div class="card">
        ${recent.length ? recent.map(x => txRow(x, false)).join('') : '<div class="empty">Belum ada transaksi. Tekan “Tambah Pemasukan” untuk memulai.</div>'}
      </div>
    </section>
  `;
  const s = savingsSeries('monthly', true);
  drawChart('chart-home', s.labels, s.values, 'line');
}

function renderSavings() {
  const txs = state.data.transactions;
  const t = totals(txs);
  const range = state.savingsRange;
  const targets = state.data.targets;
  const seg = [['weekly', 'Mingguan'], ['monthly', 'Bulanan'], ['yearly', 'Tahunan']]
    .map(([k, l]) => `<button class="${range === k ? 'active' : ''}" data-action="savings-range" data-range="${k}">${l}</button>`)
    .join('');

  $('#view-tabungan').innerHTML = `
    <h2 class="page-title">Tabungan</h2>

    <div class="card">
      <div class="meta">Total seluruh tabungan</div>
      <div class="big">${rp(t.tabungan)}</div>
      <p class="meta" style="margin-top:6px">Gabungan kategori Tabungan utama, Dana darurat kendaraan, dan Dana cadangan.</p>
    </div>

    <section class="section">
      <div class="card">
        <div class="section-head">
          <h3>Setoran bersih</h3>
          <div class="seg">${seg}</div>
        </div>
        <div class="chart-box"><canvas id="chart-savings" aria-label="Grafik tabungan"></canvas></div>
        <p class="meta" style="margin-top:8px">Selisih pemasukan dan pengeluaran pada kategori tabungan per periode.</p>
      </div>
    </section>

    <section class="section">
      <div class="section-head">
        <h3>Target tabungan</h3>
        <button class="btn btn-primary btn-sm" data-action="add-target">${icon('plus')} Tambah target</button>
      </div>
      ${targets.length ? targets.map(tg => {
        const c = catById(tg.categoryId);
        const bal = catBalance(txs, tg.categoryId);
        const pct = tg.target > 0 ? Math.max(0, bal / tg.target * 100) : 0;
        const est = estimateTarget(tg, bal);
        return `
        <div class="card target">
          <div class="row-between">
            <div>
              <div class="name">${esc(tg.name)}</div>
              <div class="meta">${c.icon} ${esc(c.name)}</div>
            </div>
            <div class="center-x">
              <button class="icon-btn" data-action="edit-target" data-id="${tg.id}" aria-label="Edit target">${icon('edit')}</button>
              <button class="icon-btn danger" data-action="del-target" data-id="${tg.id}" aria-label="Hapus target">${icon('trash')}</button>
            </div>
          </div>
          <div class="row-between">
            <span class="bal" style="font-weight:800">${rp(bal)}</span>
            <span class="meta">dari ${rp(tg.target)}</span>
          </div>
          <div class="bar lg"><span style="width:${Math.min(pct, 100).toFixed(1)}%;background:${c.color}"></span></div>
          <div class="foot">
            <span class="pill ${est.done ? 'ok' : ''}">${Math.min(pct, 100).toFixed(0)}%</span>
            <span class="meta">${est.text}</span>
          </div>
        </div>`;
      }).join('') : '<div class="card empty">Belum ada target. Buat target seperti “Dana motor baru” agar progres terlihat.</div>'}
    </section>
  `;
  const s = savingsSeries(range, false);
  drawChart('chart-savings', s.labels, s.values, 'bar');
}

function renderTx() {
  const all = [...state.data.transactions].sort(sortTx);
  const m = state.txMonth;
  const list = m ? all.filter(t => t.date.startsWith(m)) : all;
  const tt = totals(list);
  const groups = {};
  list.forEach(t => { (groups[t.date] = groups[t.date] || []).push(t); });
  const days = Object.keys(groups).sort().reverse();

  $('#view-transaksi').innerHTML = `
    <h2 class="page-title">Riwayat transaksi</h2>

    <div class="card filter-bar">
      <label class="field">
        <span>Tampilkan bulan</span>
        <input class="input" type="month" id="tx-month" value="${m || ''}">
      </label>
      <button class="btn btn-ghost btn-sm" data-action="tx-all" style="height:48px">Semua bulan</button>
    </div>

    <div class="stats">
      ${statCard('Uang masuk', 'arrowIn', rp(tt.masuk), 'dot-in')}
      ${statCard('Uang keluar', 'arrowOut', rp(tt.keluar), 'dot-out')}
    </div>

    <section class="section">
      <div class="card">
        ${days.length
          ? days.map(d => `<div class="day-head">${fmtDate(d)}</div>` + groups[d].map(t => txRow(t)).join('')).join('')
          : '<div class="empty">Tidak ada transaksi pada periode ini.</div>'}
      </div>
    </section>
  `;
}

function renderBudget() {
  const b = state.data.budget;
  const allocated = b.items.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const rest = b.total - allocated;
  const over = rest < 0;
  const pctAlloc = b.total > 0 ? Math.min(allocated / b.total * 100, 100) : 0;
  const pctRest = b.total > 0 ? rest / b.total * 100 : 0;

  $('#view-anggaran').innerHTML = `
    <h2 class="page-title">Anggaran mingguan</h2>

    <div class="card">
      <div class="row-between">
        <div>
          <div class="meta">Total uang mingguan</div>
          <div class="big">${rp(b.total)}</div>
        </div>
        <button class="btn btn-ghost btn-sm" data-action="edit-budget-total">${icon('edit')} Ubah</button>
      </div>
      <div class="bar lg" style="margin-top:14px"><span style="width:${pctAlloc.toFixed(1)}%;background:${over ? 'var(--red)' : 'var(--blue)'}"></span></div>
      <div class="row-between meta" style="margin-top:8px">
        <span>Dialokasikan ${(b.total > 0 ? allocated / b.total * 100 : 0).toFixed(1)}%</span>
        <span class="${over ? 'dot-out' : ''}" style="font-weight:700">${over ? 'Melebihi total ' + rp(-rest) : 'Sisa ' + rp(rest)}</span>
      </div>
    </div>

    <section class="section">
      <div class="section-head">
        <h3>Alokasi anggaran</h3>
        <button class="btn btn-primary btn-sm" data-action="add-budget">${icon('plus')} Tambah</button>
      </div>
      <div class="card">
        ${b.items.length ? b.items.map(i => {
          const amt = Number(i.amount) || 0;
          const p = b.total > 0 ? amt / b.total * 100 : 0;
          return `
          <div class="budget-item">
            <div class="row-between">
              <div style="min-width:0">
                <div class="title">${esc(i.name)}</div>
                <div class="meta">${p.toFixed(1)}% dari total</div>
              </div>
              <div class="row-between" style="gap:4px">
                <span class="amt">${rp(amt)}</span>
                <button class="icon-btn" data-action="edit-budget" data-id="${i.id}" aria-label="Edit alokasi">${icon('edit')}</button>
                <button class="icon-btn danger" data-action="del-budget" data-id="${i.id}" aria-label="Hapus alokasi">${icon('trash')}</button>
              </div>
            </div>
            <div class="bar"><span style="width:${Math.min(p, 100).toFixed(1)}%"></span></div>
          </div>`;
        }).join('') : '<div class="empty">Belum ada alokasi. Tekan “Tambah”.</div>'}

        <div class="budget-item">
          <div class="row-between">
            <div>
              <div class="title">Sisa fleksibel</div>
              <div class="meta">Otomatis: total dikurangi semua alokasi</div>
            </div>
            <span class="amt ${over ? 'dot-out' : 'dot-in'}">${rp(rest)}</span>
          </div>
          <div class="bar"><span style="width:${Math.max(0, Math.min(pctRest, 100)).toFixed(1)}%;background:var(--green)"></span></div>
          <div class="meta">${pctRest.toFixed(1)}% dari total</div>
        </div>
      </div>
    </section>
  `;
}

function renderProfile() {
  const txs = state.data.transactions;
  $('#view-profil').innerHTML = `
    <h2 class="page-title">Profil</h2>

    <div class="card profile">
      <div class="avatar">${esc((state.name || '?').charAt(0).toUpperCase())}</div>
      <div style="min-width:0">
        <div class="name">${esc(state.name)}</div>
        <div class="meta">@${esc(state.user)}</div>
      </div>
    </div>

    <div class="stats">
      ${statCard('Transaksi', 'list', txs.length)}
      ${statCard('Target aktif', 'target', state.data.targets.length)}
    </div>

    <section class="section">
      <div class="card">
        <button class="menu-item" data-action="profile-name">${icon('user')} Ubah nama</button>
        <button class="menu-item" data-action="profile-pass">${icon('edit')} Ubah password</button>
        <button class="menu-item" data-action="export">${icon('download')} Ekspor data (cadangan JSON)</button>
        <button class="menu-item" data-action="import">${icon('upload')} Impor data cadangan</button>
        <button class="menu-item danger" data-action="reset">${icon('trash')} Hapus semua transaksi &amp; target</button>
        <button class="menu-item danger" data-action="logout">${icon('logout')} Keluar</button>
      </div>
    </section>

    <p class="meta center" style="margin-top:18px">Data tersimpan di browser perangkat ini. Simpan cadangan JSON secara berkala.</p>
  `;
}

/* ---------- Modal ---------- */
function openModal(title, html, bind) {
  $('#modal-title').textContent = title;
  const body = $('#modal-body');
  body.innerHTML = html;
  body.onclick = null;
  body.onsubmit = null;
  $('#modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  if (bind) bind(body);
}

function closeModal() {
  $('#modal').classList.add('hidden');
  const body = $('#modal-body');
  body.onclick = null;
  body.onsubmit = null;
  body.innerHTML = '';
  document.body.style.overflow = '';
}

function showToast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => t.classList.add('hidden'), 2200);
}

/* ---------- Transaksi ---------- */
function txFormHTML(d) {
  const isEdit = !!d.id;
  return `
  <form id="tx-form" class="form-stack" novalidate>
    <div class="type-switch">
      <button type="button" class="in ${d.type === 'in' ? 'active' : ''}" data-type="in">Pemasukan</button>
      <button type="button" class="out ${d.type === 'out' ? 'active' : ''}" data-type="out">Pengeluaran</button>
    </div>

    <label class="field">
      <span>Nominal (Rp)</span>
      <input class="input amount-input" id="tx-amount" inputmode="numeric" placeholder="0" data-money value="${fmtInputNum(d.amount)}" autocomplete="off">
    </label>

    <div class="field">
      <span>Kategori</span>
      <div class="cat-picker">
        ${CATEGORIES.map(c => `
          <button type="button" class="cat-pick ${d.categoryId === c.id ? 'active' : ''}" data-cat-pick="${c.id}">
            <span class="cat-ico" style="background:${c.color}1F">${c.icon}</span>${esc(c.name)}
          </button>`).join('')}
      </div>
    </div>

    <label class="field">
      <span>Tanggal</span>
      <input class="input" type="date" id="tx-date" value="${d.date}" required>
    </label>

    <label class="field">
      <span>Catatan (opsional)</span>
      <textarea class="input" id="tx-note" maxlength="120" placeholder="Contoh: isi bensin motor">${esc(d.note)}</textarea>
    </label>

    <p class="form-error" id="tx-error" role="alert"></p>
    <button class="btn btn-primary btn-block" type="submit">Simpan</button>
    ${isEdit ? `<button type="button" class="btn btn-danger btn-block" data-delete-tx="${d.id}">${icon('trash')} Hapus transaksi</button>` : ''}
  </form>`;
}

function openTxForm(draft) {
  const d = { ...draft };
  const title = d.id ? 'Edit transaksi' : (d.type === 'in' ? 'Tambah Pemasukan' : 'Tambah Pengeluaran');
  openModal(title, txFormHTML(d), body => {
    body.onclick = e => {
      const btn = e.target.closest('[data-type],[data-cat-pick],[data-delete-tx]');
      if (!btn) return;
      if (btn.dataset.type) {
        d.type = btn.dataset.type;
        body.querySelectorAll('[data-type]').forEach(b => b.classList.toggle('active', b === btn));
      } else if (btn.dataset.catPick) {
        d.categoryId = btn.dataset.catPick;
        body.querySelectorAll('[data-cat-pick]').forEach(b => b.classList.toggle('active', b === btn));
      } else if (btn.dataset.deleteTx) {
        deleteTx(btn.dataset.deleteTx);
      }
    };
    body.onsubmit = e => {
      e.preventDefault();
      const err = body.querySelector('#tx-error');
      const amount = parseMoney(body.querySelector('#tx-amount').value);
      const date = body.querySelector('#tx-date').value;
      const note = body.querySelector('#tx-note').value.trim().slice(0, 120);
      if (!amount) return err.textContent = 'Nominal harus lebih dari Rp0.';
      if (!date) return err.textContent = 'Tanggal wajib diisi.';
      if (!d.categoryId) return err.textContent = 'Pilih kategori terlebih dahulu.';

      const rec = { id: d.id || uid(), type: d.type, amount, categoryId: d.categoryId, date, note, created: d.created || Date.now() };
      const list = state.data.transactions;
      const idx = list.findIndex(x => x.id === rec.id);
      if (idx >= 0) list[idx] = rec; else list.push(rec);
      if (state.txMonth && !date.startsWith(state.txMonth)) state.txMonth = null;
      saveData();
      closeModal();
      showToast(d.id ? 'Transaksi diperbarui' : 'Transaksi tersimpan');
      refresh();
    };
  });
}

function deleteTx(id) {
  if (!confirm('Hapus transaksi ini?')) return;
  state.data.transactions = state.data.transactions.filter(t => t.id !== id);
  saveData();
  closeModal();
  showToast('Transaksi dihapus');
  refresh();
}

/* Detail riwayat per kategori */
function openCategory(id) {
  const c = catById(id);
  const list = state.data.transactions.filter(t => t.categoryId === id).sort(sortTx);
  const tt = totals(list);
  const bal = catBalance(list, id);
  openModal(c.name, `
    <div class="row-between" style="margin-bottom:4px">
      <span class="cat-ico" style="background:${c.color}1F;width:52px;height:52px;font-size:24px">${c.icon}</span>
      <div style="text-align:right">
        <div class="meta">Saldo kategori</div>
        <div class="big" style="color:${bal < 0 ? 'var(--red)' : c.color}">${rp(bal)}</div>
      </div>
    </div>
    <div class="cat-summary">
      <div class="stat"><div class="k">Masuk</div><div class="v dot-in">${rp(tt.masuk)}</div></div>
      <div class="stat"><div class="k">Keluar</div><div class="v dot-out">${rp(tt.keluar)}</div></div>
      <div class="stat"><div class="k">Transaksi</div><div class="v">${list.length}</div></div>
    </div>
    <div class="card" style="padding:4px 14px">
      ${list.length ? list.map(t => txRow(t)).join('') : '<div class="empty">Belum ada riwayat di kategori ini.</div>'}
    </div>
  `);
}

/* ---------- Target tabungan ---------- */
function openTargetForm(t) {
  const d = t || { name: '', target: 0, categoryId: 'main_savings' };
  const opts = CATEGORIES.filter(c => c.savings).map(c =>
    `<option value="${c.id}" ${d.categoryId === c.id ? 'selected' : ''}>${c.icon} ${esc(c.name)}</option>`).join('');
  openModal(t ? 'Edit target' : 'Tambah target', `
    <form id="target-form" class="form-stack" novalidate>
      <label class="field">
        <span>Nama target</span>
        <input class="input" id="tg-name" maxlength="40" value="${esc(d.name)}" placeholder="Contoh: Dana motor baru" required>
      </label>
      <label class="field">
        <span>Target nominal (Rp)</span>
        <input class="input" id="tg-target" inputmode="numeric" data-money value="${fmtInputNum(d.target)}" placeholder="0">
      </label>
      <label class="field">
        <span>Dihitung dari kategori</span>
        <select class="input" id="tg-cat">${opts}</select>
      </label>
      <p class="meta">Progres dihitung dari saldo kategori tersebut. Perkiraan waktu memakai rata-rata setoran bersih 90 hari terakhir.</p>
      <p class="form-error" id="tg-error" role="alert"></p>
      <button class="btn btn-primary btn-block" type="submit">Simpan target</button>
    </form>`, body => {
    body.onsubmit = e => {
      e.preventDefault();
      const name = body.querySelector('#tg-name').value.trim();
      const target = parseMoney(body.querySelector('#tg-target').value);
      const categoryId = body.querySelector('#tg-cat').value;
      const err = body.querySelector('#tg-error');
      if (!name) return err.textContent = 'Nama target wajib diisi.';
      if (!target) return err.textContent = 'Target nominal harus lebih dari Rp0.';
      if (t) {
        Object.assign(t, { name, target, categoryId });
      } else {
        state.data.targets.push({ id: uid(), name, target, categoryId });
      }
      saveData();
      closeModal();
      showToast('Target disimpan');
      refresh();
    };
  });
}

/* ---------- Anggaran ---------- */
function openBudgetTotal() {
  openModal('Total uang mingguan', `
    <form id="bt-form" class="form-stack" novalidate>
      <label class="field">
        <span>Total (Rp)</span>
        <input class="input amount-input" id="bt-amount" inputmode="numeric" data-money value="${fmtInputNum(state.data.budget.total)}">
      </label>
      <p class="form-error" id="bt-error" role="alert"></p>
      <button class="btn btn-primary btn-block" type="submit">Simpan</button>
    </form>`, body => {
    body.onsubmit = e => {
      e.preventDefault();
      const v = parseMoney(body.querySelector('#bt-amount').value);
      if (!v) return body.querySelector('#bt-error').textContent = 'Total harus lebih dari Rp0.';
      state.data.budget.total = v;
      saveData();
      closeModal();
      showToast('Total anggaran diperbarui');
      refresh();
    };
  });
}

function openBudgetItem(item) {
  const d = item || { name: '', amount: 0 };
  openModal(item ? 'Edit alokasi' : 'Tambah alokasi', `
    <form id="bi-form" class="form-stack" novalidate>
      <label class="field">
        <span>Nama alokasi</span>
        <input class="input" id="bi-name" maxlength="40" value="${esc(d.name)}" placeholder="Contoh: Bensin" required>
      </label>
      <label class="field">
        <span>Nominal per minggu (Rp)</span>
        <input class="input" id="bi-amount" inputmode="numeric" data-money value="${fmtInputNum(d.amount)}" placeholder="0">
      </label>
      <p class="form-error" id="bi-error" role="alert"></p>
      <button class="btn btn-primary btn-block" type="submit">Simpan</button>
      ${item ? `<button type="button" class="btn btn-danger btn-block" id="bi-delete">${icon('trash')} Hapus alokasi</button>` : ''}
    </form>`, body => {
    body.onclick = e => {
      if (e.target.closest('#bi-delete')) deleteBudgetItem(item.id);
    };
    body.onsubmit = e => {
      e.preventDefault();
      const name = body.querySelector('#bi-name').value.trim();
      const amount = parseMoney(body.querySelector('#bi-amount').value);
      const err = body.querySelector('#bi-error');
      if (!name) return err.textContent = 'Nama alokasi wajib diisi.';
      if (!amount) return err.textContent = 'Nominal harus lebih dari Rp0.';
      if (item) {
        item.name = name;
        item.amount = amount;
      } else {
        state.data.budget.items.push({ id: uid(), name, amount });
      }
      saveData();
      closeModal();
      showToast('Alokasi disimpan');
      refresh();
    };
  });
}

function deleteBudgetItem(id) {
  if (!confirm('Hapus alokasi ini?')) return;
  state.data.budget.items = state.data.budget.items.filter(i => i.id !== id);
  saveData();
  closeModal();
  showToast('Alokasi dihapus');
  refresh();
}

/* ---------- Profil ---------- */
function openNameForm() {
  openModal('Ubah nama', `
    <form id="name-form" class="form-stack" novalidate>
      <label class="field">
        <span>Nama</span>
        <input class="input" id="nm-name" maxlength="40" value="${esc(state.name)}" required>
      </label>
      <p class="form-error" id="nm-error" role="alert"></p>
      <button class="btn btn-primary btn-block" type="submit">Simpan</button>
    </form>`, body => {
    body.onsubmit = e => {
      e.preventDefault();
      const name = body.querySelector('#nm-name').value.trim();
      if (!name) return body.querySelector('#nm-error').textContent = 'Nama wajib diisi.';
      Auth.updateName(state.user, name);
      state.name = name;
      $('#topbar-user').textContent = name;
      closeModal();
      showToast('Nama diperbarui');
      refresh();
    };
  });
}

function openPasswordForm() {
  openModal('Ubah password', `
    <form id="pass-form" class="form-stack" novalidate>
      <label class="field"><span>Password lama</span><input class="input" type="password" id="pw-old" autocomplete="current-password"></label>
      <label class="field"><span>Password baru (min. 6 karakter)</span><input class="input" type="password" id="pw-new" autocomplete="new-password"></label>
      <label class="field"><span>Ulangi password baru</span><input class="input" type="password" id="pw-new2" autocomplete="new-password"></label>
      <p class="form-error" id="pw-error" role="alert"></p>
      <button class="btn btn-primary btn-block" type="submit">Ubah password</button>
    </form>`, body => {
    body.onsubmit = async e => {
      e.preventDefault();
      const err = body.querySelector('#pw-error');
      const oldPw = body.querySelector('#pw-old').value;
      const newPw = body.querySelector('#pw-new').value;
      const newPw2 = body.querySelector('#pw-new2').value;
      if (newPw.length < 6) return err.textContent = 'Password baru minimal 6 karakter.';
      if (newPw !== newPw2) return err.textContent = 'Konfirmasi password tidak sama.';
      try {
        await Auth.changePassword(state.user, oldPw, newPw);
        closeModal();
        showToast('Password berhasil diubah');
      } catch (ex) {
        err.textContent = ex.message;
      }
    };
  });
}

function exportData() {
  const payload = {
    app: APP.name,
    version: APP.version,
    exported: new Date().toISOString(),
    data: state.data
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'tabungan-kita-' + todayISO() + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  showToast('Cadangan JSON diunduh');
}

function importFile(input) {
  const file = input.files && input.files[0];
  input.value = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const obj = JSON.parse(reader.result);
      const d = obj && obj.data ? obj.data : obj;
      if (!d || !Array.isArray(d.transactions)) throw new Error('format');
      if (!confirm('Impor akan menggantikan data saat ini di perangkat ini. Lanjutkan?')) return;
      state.data = normalizeData(d);
      saveData();
      showToast('Data berhasil diimpor');
      refresh();
    } catch (err) {
      showToast('File cadangan tidak valid');
    }
  };
  reader.readAsText(file);
}

/* ---------- Sesi ---------- */
function showApp() {
  $('#auth-screen').classList.add('hidden');
  $('#app-screen').classList.remove('hidden');
}

function showAuth() {
  $('#app-screen').classList.add('hidden');
  $('#auth-screen').classList.remove('hidden');
}

function startSession(username) {
  const u = Auth.users()[username];
  if (!u) return showAuth();
  state.user = username;
  state.name = u.name;
  state.data = loadData(username);
  state.txMonth = monthKeyOf(todayISO());
  $('#topbar-user').textContent = u.name;
  showApp();
  setView('home');
}

function logout() {
  if (!confirm('Keluar dari akun ini?')) return;
  Auth.logout();
  Object.values(state.charts).forEach(c => c.destroy());
  state.charts = {};
  state.user = null;
  state.data = null;
  closeModal();
  showAuth();
}

/* ---------- Event handler ---------- */
function onClick(e) {
  const nav = e.target.closest('[data-nav]');
  if (nav) return setView(nav.dataset.nav);

  if (e.target.closest('[data-close]')) return closeModal();

  const el = e.target.closest('[data-action]');
  if (!el || !state.user) return;
  const id = el.dataset.id;

  switch (el.dataset.action) {
    case 'add-in':  return openTxForm({ type: 'in', amount: 0, categoryId: 'main_savings', date: todayISO(), note: '' });
    case 'add-out': return openTxForm({ type: 'out', amount: 0, categoryId: 'food', date: todayISO(), note: '' });
    case 'edit-tx': {
      const tx = state.data.transactions.find(x => x.id === id);
      if (tx) openTxForm({ ...tx });
      return;
    }
    case 'del-tx': return deleteTx(id);
    case 'cat': return openCategory(id);
    case 'tx-all': state.txMonth = null; return renderTx();
    case 'savings-range': state.savingsRange = el.dataset.range; return renderSavings();
    case 'add-target': return openTargetForm();
    case 'edit-target': {
      const tg = state.data.targets.find(x => x.id === id);
      if (tg) openTargetForm(tg);
      return;
    }
    case 'del-target': {
      if (!confirm('Hapus target ini?')) return;
      state.data.targets = state.data.targets.filter(x => x.id !== id);
      saveData();
      showToast('Target dihapus');
      return refresh();
    }
    case 'edit-budget-total': return openBudgetTotal();
    case 'add-budget': return openBudgetItem();
    case 'edit-budget': {
      const it = state.data.budget.items.find(x => x.id === id);
      if (it) openBudgetItem(it);
      return;
    }
    case 'del-budget': return deleteBudgetItem(id);
    case 'profile-name': return openNameForm();
    case 'profile-pass': return openPasswordForm();
    case 'export': return exportData();
    case 'import': return $('#import-file').click();
    case 'reset': {
      if (!confirm('Hapus SEMUA transaksi dan target di akun ini? Tindakan ini tidak bisa dibatalkan.')) return;
      state.data.transactions = [];
      state.data.targets = [];
      saveData();
      showToast('Transaksi & target dihapus');
      return refresh();
    }
    case 'logout': return logout();
  }
}

function init() {
  document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); });

  document.addEventListener('click', onClick);

  document.addEventListener('input', e => {
    if (e.target.matches('[data-money]')) {
      const v = parseMoney(e.target.value);
      e.target.value = fmtInputNum(v);
    }
  });

  document.addEventListener('change', e => {
    if (e.target.id === 'tx-month') {
      state.txMonth = e.target.value || null;
      renderTx();
    } else if (e.target.id === 'import-file') {
      importFile(e.target);
    }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !$('#modal').classList.contains('hidden')) closeModal();
  });

  initAuth(username => startSession(username));

  const current = Auth.current();
  if (current) startSession(current);
  else showAuth();
}

document.addEventListener('DOMContentLoaded', init);
