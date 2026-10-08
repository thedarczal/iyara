# Siap upload ke Vercel

Isi folder ini harus berada di ROOT repo GitHub (package.json, vercel.json, api/, public/ langsung terlihat).

## A. Siapkan MongoDB Atlas (sekali saja, ±5 menit, harus lewat akun Anda)
1. Daftar di https://www.mongodb.com/atlas -> buat cluster gratis (M0).
2. Database Access -> Add New Database User -> isi username & password (catat). Sebaiknya password tanpa simbol.
3. Network Access -> Add IP Address -> Allow Access from Anywhere (0.0.0.0/0) -> Confirm (tunggu Active).
4. Connect -> Drivers -> catat HOST cluster (contoh: cluster0.abcde.mongodb.net).

## B. Buat MONGODB_URI otomatis (password di-encode)
    npm install
    npm run make-uri
Isi username, password, dan host. Salin hasilnya. (Opsional) tes dulu:
    MONGODB_URI="hasil-tadi" npm run check-db      (Windows: set MONGODB_URI=hasil-tadi && npm run check-db)
Harus tampil BERHASIL.

## C. Upload & deploy
1. Upload isi folder ini ke repo GitHub baru (jangan upload node_modules / .env).
2. vercel.com -> Add New Project -> pilih repo -> Framework: Other -> jangan ubah Build/Output.
3. Environment Variables (centang Production, Preview, Development):
   - MONGODB_URI = hasil langkah B (tanpa tanda kutip)
   - SECRET      = teks acak panjang: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   - RESEND_API_KEY, MAIL_FROM  (opsional, untuk email lupa kata sandi)
4. Deploy. Buka https://NAMA-ANDA.vercel.app/api/health -> harus {"ok":true}.
