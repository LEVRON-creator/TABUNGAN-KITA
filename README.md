# TABUNGAN KITA

Aplikasi pencatat keuangan pribadi yang sederhana, modern, dan responsif. Dibuat dengan HTML, CSS, dan JavaScript murni, dengan Chart.js untuk grafik. Data disimpan di **localStorage** browser, tanpa backend dan tanpa API key.

## Fitur

- **Login & daftar akun lokal** dengan tombol tampil/sembunyikan password.
- **Dashboard**: total tabungan, total uang masuk, total uang keluar, saldo tersedia, grafik perkembangan tabungan, dan riwayat terbaru.
- **8 kategori keuangan** dengan ikon, warna, saldo, dan riwayat sendiri.
- **Transaksi**: tambah pemasukan/pengeluaran, pilih kategori, nominal Rupiah, tanggal, catatan, edit, hapus, dan filter per bulan dengan pengelompokan per tanggal.
- **Tabungan**: target tabungan, progress bar, dan perkiraan waktu mencapai target. Grafik mingguan, bulanan, dan tahunan.
- **Anggaran mingguan** yang bisa diedit: total, alokasi, persentase setiap alokasi, dan sisa fleksibel yang dihitung otomatis.
- **Profil**: ubah nama, ubah password, ekspor/impor cadangan JSON, hapus data, dan keluar.
- Navigasi bawah 5 menu: Home, Tabungan, Transaksi, Anggaran, Profil.

## Struktur file

```
tabungan-kita/
├── index.html      # Halaman utama (login + aplikasi)
├── README.md
├── css/
│   └── style.css   # Tema biru putih & navy, mobile-first
└── js/
    ├── data.js     # Kategori, ikon, penyimpanan, utilitas (format Rupiah, tanggal)
    ├── auth.js     # Login/daftar lokal
    └── app.js      # Logika aplikasi, render, dan grafik
```

## Cara upload ke GitHub

1. Buat repositori baru di GitHub, misalnya `tabungan-kita`. Repositori boleh publik (wajib publik jika memakai GitHub Pages gratis).
2. Upload seluruh isi folder `tabungan-kita/` (file `index.html`, `README.md`, folder `css/`, dan `js/`) ke **root** repositori. Bisa lewat tombol **Add file → Upload files** di GitHub, atau dengan Git:

   ```bash
   cd tabungan-kita
   git init
   git add .
   git commit -m "Initial commit: TABUNGAN KITA"
   git branch -M main
   git remote add origin https://github.com/USERNAME/tabungan-kita.git
   git push -u origin main
   ```

3. Pastikan `index.html` berada di root, bukan di dalam subfolder.

## Mengaktifkan GitHub Pages

1. Buka repositori di GitHub, lalu pilih **Settings**.
2. Pilih menu **Pages** di sidebar kiri.
3. Pada **Build and deployment → Source**, pilih **Deploy from a branch**.
4. Pada **Branch**, pilih `main` dan folder `/ (root)`, lalu klik **Save**.
5. Tunggu 1–2 menit. Alamat situs akan muncul, dengan format:

   `https://USERNAME.github.io/tabungan-kita/`

Buka alamat tersebut di HP Android (Chrome). Untuk menambahkannya ke layar utama, pilih menu ⋮ lalu **Tambahkan ke layar utama**.

## Catatan penting

- **Autentikasi ini hanya untuk penggunaan pribadi/demo.** Akun dan password disimpan di browser perangkat, sehingga ini bukan sistem keamanan akun produksi. Jangan memakai password yang sama dengan akun penting Anda.
- **Data tersimpan per browser dan per perangkat.** Data tidak sinkron antar HP atau komputer. Hapus data browser akan menghapus data aplikasi. Karena itu, simpan cadangan secara berkala lewat **Profil → Ekspor data (cadangan JSON)**, lalu gunakan **Impor data cadangan** di perangkat lain.
- Saldo awal **nol**. Tidak ada data keuangan contoh. Anggaran awal (Rp120.000 per minggu) hanya contoh rencana yang bisa Anda ubah.
- Chart.js dimuat dari CDN (`cdn.jsdelivr.net`), sehingga grafik memerlukan koneksi internet saat pertama kali dibuka.

## Lisensi

Bebas dipakai untuk keperluan pribadi.
