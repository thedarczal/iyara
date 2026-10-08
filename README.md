# Simple Plant Disease Checker - versi Vercel + MongoDB Atlas

Akun dan riwayat disimpan di MongoDB Atlas (bukan file), jadi aman di Vercel.

## 1. Siapkan MongoDB Atlas (gratis)
1. Daftar di https://www.mongodb.com/atlas, buat cluster gratis (M0).
2. Menu "Database Access" -> Add New Database User -> isi username & password (catat).
3. Menu "Network Access" -> Add IP Address -> "Allow Access from Anywhere" (0.0.0.0/0).
   (Wajib untuk Vercel karena IP-nya berubah-ubah.)
4. Klik "Connect" pada cluster -> "Drivers" -> salin connection string, contoh:
   mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   Ganti USER dan PASSWORD. Jika password ada karakter khusus (@ : / ?), ubah ke bentuk URL-encoded.

## 2. Deploy ke Vercel
1. Upload folder ini ke GitHub (file .env jangan ikut; sudah ada di .gitignore).
2. vercel.com -> Add New Project -> pilih repo. Framework: "Other". Biarkan Build/Output kosong.
3. Sebelum Deploy, buka "Environment Variables" dan isi:
   - MONGODB_URI = connection string dari langkah 1
   - SECRET      = teks acak panjang (mis. 40+ karakter)
   - DB_NAME     = plantcheck (opsional)
4. Klik Deploy. Jika env diisi setelah deploy, lakukan Redeploy.

## 3. Cek
Buka https://NAMA-ANDA.vercel.app/api/health -> harus tampil {"ok":true}.
Jika tampil error, pesannya menyebut penyebabnya (env belum diisi / IP belum diizinkan / password salah).
Lalu coba Daftar dari perangkat lain.

## Jalan di komputer sendiri (opsional)
npm install
set/export MONGODB_URI=... (dan SECRET)
npm start  -> http://localhost:3000 (menjalankan local.js)

## Fitur baru (v3)
- Beranda berisi ringkasan proposal, tampilan Periksa daun, Riwayat, dan Profil (foto profil + data diri + ganti kata sandi).
- Lupa kata sandi: kode 6 digit dikirim lewat email, berlaku 15 menit.

### Mengaktifkan email lupa kata sandi (Vercel)
1. Daftar di https://resend.com, buat API key.
2. Tambah Environment Variables di Vercel: RESEND_API_KEY dan (opsional) MAIL_FROM.
3. Tanpa domain terverifikasi, Resend hanya mengizinkan kirim ke email pemilik akun Resend.
   Untuk mengirim ke semua pengguna, verifikasi domain Anda di Resend lalu isi MAIL_FROM
   (contoh: "Plant Checker <noreply@domainanda.com>").
4. Redeploy.
Jika dijalankan lokal tanpa RESEND_API_KEY, kode reset ditampilkan di layar (hanya untuk uji coba).
