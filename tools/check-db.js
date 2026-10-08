// Menguji koneksi MongoDB sebelum upload.
// Pakai: MONGODB_URI="mongodb+srv://..." npm run check-db
const { MongoClient } = require('mongodb');
const uri = (process.env.MONGODB_URI || process.argv[2] || '').trim();
if (!/^mongodb(\+srv)?:\/\//.test(uri)) {
  console.error('GAGAL: URI harus diawali mongodb+srv:// atau mongodb:// (tanpa tanda kutip/nama variabel).');
  process.exit(1);
}
if (/[<>]/.test(uri)) { console.error('GAGAL: masih ada tanda < > — ganti <password> dengan password asli.'); process.exit(1); }
new MongoClient(uri, { serverSelectionTimeoutMS: 8000 }).connect()
  .then(async c => { await c.db('admin').command({ ping: 1 }); console.log('BERHASIL: terhubung ke MongoDB Atlas.'); await c.close(); })
  .catch(e => {
    const m = String(e.message);
    console.error('GAGAL:', m);
    if (/bad auth|Authentication/i.test(m)) console.error('→ Username/password salah (atau password belum di-encode: pakai npm run make-uri).');
    else if (/ENOTFOUND|querySrv/i.test(m)) console.error('→ Alamat host salah. Salin ulang dari Atlas → Connect → Drivers.');
    else console.error('→ Kemungkinan IP belum diizinkan: Atlas → Network Access → Allow Access from Anywhere (0.0.0.0/0).');
    process.exit(1);
  });
