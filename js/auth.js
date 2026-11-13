/* ==========================================================
   TABUNGAN KITA — autentikasi lokal sederhana
   CATATAN: hanya untuk penggunaan pribadi/demo. Ini BUKAN
   sistem keamanan akun produksi (semua data ada di browser).
   ========================================================== */

const Auth = {
  users() {
    return Store.read(APP.keys.users, {});
  },

  saveUsers(users) {
    return Store.write(APP.keys.users, users);
  },

  async hash(salt, password) {
    const text = salt + '|' + password;
    if (window.crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
    }
    // Cadangan jika Web Crypto tidak tersedia (bukan hashing kuat).
    return 'b64:' + btoa(unescape(encodeURIComponent(text)));
  },

  current() {
    const u = Store.read(APP.keys.session, null);
    return u && this.users()[u] ? u : null;
  },

  async register(name, username, password) {
    const users = this.users();
    if (users[username]) throw new Error('Username sudah terdaftar.');
    const salt = uid();
    users[username] = { name, salt, hash: await this.hash(salt, password), created: todayISO() };
    if (!this.saveUsers(users)) throw new Error('Penyimpanan browser tidak tersedia.');
    Store.write(APP.keys.session, username);
    return username;
  },

  async login(username, password) {
    const u = this.users()[username];
    if (!u) throw new Error('Username atau password salah.');
    if ((await this.hash(u.salt, password)) !== u.hash) {
      throw new Error('Username atau password salah.');
    }
    Store.write(APP.keys.session, username);
    return username;
  },

  logout() {
    Store.remove(APP.keys.session);
  },

  updateName(username, name) {
    const users = this.users();
    if (!users[username]) return;
    users[username].name = name;
    this.saveUsers(users);
  },

  async changePassword(username, oldPassword, newPassword) {
    const users = this.users();
    const u = users[username];
    if (!u) throw new Error('Akun tidak ditemukan.');
    if ((await this.hash(u.salt, oldPassword)) !== u.hash) throw new Error('Password lama salah.');
    u.hash = await this.hash(u.salt, newPassword);
    this.saveUsers(users);
  }
};

/* Ubah ikon mata pada tombol tampil/sembunyikan password */
function bindPasswordToggles() {
  document.querySelectorAll('[data-toggle]').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.toggle);
      if (!input) return;
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.innerHTML = icon(show ? 'eyeOff' : 'eye');
      btn.setAttribute('aria-label', show ? 'Sembunyikan password' : 'Tampilkan password');
    });
  });
}

/* Inisialisasi form login & daftar. onLogin(username) dipanggil setelah berhasil. */
function initAuth(onLogin) {
  const loginForm = document.getElementById('login-form');
  const regForm = document.getElementById('register-form');
  const loginErr = document.getElementById('login-error');
  const regErr = document.getElementById('register-error');
  const subtitle = document.getElementById('auth-subtitle');
  const switchText = document.getElementById('switch-text');
  const switchBtn = document.getElementById('switch-auth');
  let mode = 'login';

  function setMode(m) {
    mode = m;
    const isLogin = m === 'login';
    loginForm.classList.toggle('hidden', !isLogin);
    regForm.classList.toggle('hidden', isLogin);
    subtitle.textContent = isLogin ? 'Masuk untuk melanjutkan' : 'Buat akun baru di perangkat ini';
    switchText.textContent = isLogin ? 'Belum punya akun?' : 'Sudah punya akun?';
    switchBtn.textContent = isLogin ? 'Daftar akun' : 'Login';
    loginErr.textContent = '';
    regErr.textContent = '';
  }

  switchBtn.addEventListener('click', () => setMode(mode === 'login' ? 'register' : 'login'));

  loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    loginErr.textContent = '';
    const username = document.getElementById('login-user').value.trim().toLowerCase();
    const password = document.getElementById('login-pass').value;
    if (!username || !password) {
      loginErr.textContent = 'Username dan password wajib diisi.';
      return;
    }
    try {
      const user = await Auth.login(username, password);
      loginForm.reset();
      onLogin(user);
    } catch (err) {
      loginErr.textContent = err.message;
    }
  });

  regForm.addEventListener('submit', async e => {
    e.preventDefault();
    regErr.textContent = '';
    const name = document.getElementById('reg-name').value.trim();
    const username = document.getElementById('reg-user').value.trim().toLowerCase();
    const password = document.getElementById('reg-pass').value;
    const confirm = document.getElementById('reg-pass2').value;

    if (!name) return regErr.textContent = 'Nama wajib diisi.';
    if (!/^[a-z0-9_.]{3,20}$/.test(username)) {
      return regErr.textContent = 'Username 3–20 karakter: huruf kecil, angka, titik, atau garis bawah.';
    }
    if (password.length < 6) return regErr.textContent = 'Password minimal 6 karakter.';
    if (password !== confirm) return regErr.textContent = 'Konfirmasi password tidak sama.';

    try {
      const user = await Auth.register(name, username, password);
      regForm.reset();
      onLogin(user);
    } catch (err) {
      regErr.textContent = err.message;
    }
  });

  bindPasswordToggles();
  setMode('login');
}
