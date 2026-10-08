// Backend serverless (Vercel) + MongoDB Atlas. Juga dipakai server.js untuk dev lokal.
const express = require('express');
const crypto = require('crypto');
const { MongoClient } = require('mongodb');

const URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || 'plantcheck';
const SECRET = process.env.SECRET || (process.env.VERCEL ? '' : 'rahasia-lokal-untuk-dev');

const app = express();
app.use(express.json({ limit: '1mb' }));

// Koneksi di-cache agar dipakai ulang antar permintaan
let dbPromise;
function getDB() {
  if (!URI) throw new Error('MONGODB_URI belum diatur di Environment Variables.');
  if (!SECRET) throw new Error('SECRET belum diatur di Environment Variables.');
  if (!dbPromise) {
    dbPromise = new MongoClient(URI, { serverSelectionTimeoutMS: 8000 }).connect().then(async client => {
      const db = client.db(DB_NAME);
      await db.collection('users').createIndex({ email: 1 }, { unique: true });
      await db.collection('scans').createIndex({ userId: 1, createdAt: -1 });
      return db;
    }).catch(err => { dbPromise = null; throw err; });
  }
  return dbPromise;
}

const wrap = fn => (req, res) => Promise.resolve(fn(req, res)).catch(err => {
  console.error(err);
  if (err && err.code === 11000) return res.status(409).json({ error: 'Email sudah terdaftar. Coba masuk.' });
  res.status(500).json({ error: 'Server bermasalah: ' + (err.message || 'coba lagi nanti.') });
});

function hashPassword(pw, salt = crypto.randomBytes(16).toString('hex')) {
  return salt + ':' + crypto.scryptSync(pw, salt, 64).toString('hex');
}
function checkPassword(pw, stored) {
  const [salt, hash] = stored.split(':');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), crypto.scryptSync(pw, salt, 64));
}
function makeToken(id) {
  const body = Buffer.from(JSON.stringify({ id, exp: Date.now() + 7 * 864e5 })).toString('base64url');
  return body + '.' + crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
}
function readToken(token) {
  const [body, sig] = (token || '').split('.');
  if (!body || !sig || !SECRET) return null;
  const good = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
  const data = JSON.parse(Buffer.from(body, 'base64url').toString());
  return data.exp > Date.now() ? data : null;
}
function auth(req, res, next) {
  const data = readToken((req.headers.authorization || '').replace('Bearer ', ''));
  if (!data) return res.status(401).json({ error: 'Sesi berakhir. Silakan masuk kembali.' });
  req.userId = data.id;
  next();
}

app.get('/api/health', wrap(async (req, res) => { await getDB(); res.json({ ok: true }); }));

app.post('/api/register', wrap(async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password || password.length < 6)
    return res.status(400).json({ error: 'Isi nama, email, dan kata sandi (minimal 6 karakter).' });
  const db = await getDB();
  const user = { id: crypto.randomUUID(), name: String(name).trim(), email: String(email).toLowerCase().trim(), password: hashPassword(password), createdAt: new Date().toISOString() };
  await db.collection('users').insertOne(user); // email ganda -> error 11000 -> 409
  res.json({ token: makeToken(user.id), name: user.name });
}));

app.post('/api/login', wrap(async (req, res) => {
  const { email = '', password = '' } = req.body || {};
  const db = await getDB();
  const user = await db.collection('users').findOne({ email: String(email).toLowerCase().trim() });
  if (!user || !checkPassword(String(password), user.password))
    return res.status(401).json({ error: 'Email atau kata sandi salah.' });
  res.json({ token: makeToken(user.id), name: user.name });
}));

app.get('/api/scans', auth, wrap(async (req, res) => {
  const db = await getDB();
  const list = await db.collection('scans').find({ userId: req.userId }, { projection: { _id: 0, userId: 0 } })
    .sort({ createdAt: -1 }).limit(100).toArray();
  res.json(list);
}));

app.post('/api/scans', auth, wrap(async (req, res) => {
  const { condition, confidence, thumb, note } = req.body || {};
  if (!condition) return res.status(400).json({ error: 'Data hasil tidak lengkap.' });
  const db = await getDB();
  const scan = { id: crypto.randomUUID(), userId: req.userId, condition: String(condition), confidence: Number(confidence) || 0, thumb: String(thumb || '').slice(0, 20000), note: String(note || ''), createdAt: new Date().toISOString() };
  await db.collection('scans').insertOne(scan);
  const { _id, userId, ...safe } = scan;
  res.status(201).json(safe);
}));

app.delete('/api/scans/:id', auth, wrap(async (req, res) => {
  const db = await getDB();
  const r = await db.collection('scans').deleteOne({ id: req.params.id, userId: req.userId });
  if (!r.deletedCount) return res.status(404).json({ error: 'Data tidak ditemukan.' });
  res.json({ ok: true });
}));

// ---------- Profil ----------
const pub = u => ({ name: u.name, email: u.email, institution: u.institution || '', bio: u.bio || '', avatar: u.avatar || '' });

app.get('/api/me', auth, wrap(async (req, res) => {
  const u = await (await getDB()).collection('users').findOne({ id: req.userId });
  if (!u) return res.status(401).json({ error: 'Akun tidak ditemukan.' });
  res.json(pub(u));
}));

app.put('/api/me', auth, wrap(async (req, res) => {
  const { name, institution, bio, avatar } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Nama tidak boleh kosong.' });
  const set = { name: String(name).trim().slice(0, 80), institution: String(institution || '').slice(0, 120), bio: String(bio || '').slice(0, 300) };
  if (typeof avatar === 'string') {
    if (avatar && !/^data:image\/(jpeg|png|webp);base64,/.test(avatar)) return res.status(400).json({ error: 'Format foto tidak valid.' });
    if (avatar.length > 200000) return res.status(400).json({ error: 'Foto terlalu besar.' });
    set.avatar = avatar;
  }
  const db = await getDB();
  await db.collection('users').updateOne({ id: req.userId }, { $set: set });
  res.json(pub(await db.collection('users').findOne({ id: req.userId })));
}));

app.put('/api/me/password', auth, wrap(async (req, res) => {
  const { current = '', password = '' } = req.body || {};
  if (password.length < 6) return res.status(400).json({ error: 'Kata sandi baru minimal 6 karakter.' });
  const db = await getDB();
  const u = await db.collection('users').findOne({ id: req.userId });
  if (!u || !checkPassword(String(current), u.password)) return res.status(401).json({ error: 'Kata sandi saat ini salah.' });
  await db.collection('users').updateOne({ id: req.userId }, { $set: { password: hashPassword(password) } });
  res.json({ ok: true });
}));

// ---------- Lupa kata sandi (kode 6 digit via email) ----------
async function sendMail(to, code) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.MAIL_FROM || 'Plant Checker <onboarding@resend.dev>', to: [to],
      subject: 'Kode reset kata sandi',
      html: `<p>Kode reset kata sandi Anda:</p><p style="font-size:28px;letter-spacing:6px"><b>${code}</b></p><p>Berlaku 15 menit. Abaikan email ini jika bukan Anda yang meminta.</p>`
    })
  });
  return r.ok;
}
const hashCode = (email, code) => crypto.createHmac('sha256', SECRET).update(email + ':' + code).digest('hex');

app.post('/api/forgot', wrap(async (req, res) => {
  const email = String((req.body || {}).email || '').toLowerCase().trim();
  if (!email) return res.status(400).json({ error: 'Isi email Anda.' });
  if (!process.env.RESEND_API_KEY && process.env.VERCEL)
    return res.status(503).json({ error: 'Pengiriman email belum diaktifkan oleh pemilik situs (RESEND_API_KEY).' });
  const db = await getDB();
  const user = await db.collection('users').findOne({ email });
  let devCode;
  if (user) {
    const code = String(crypto.randomInt(100000, 1000000));
    await db.collection('resets').updateOne({ email }, { $set: { email, hash: hashCode(email, code), exp: Date.now() + 15 * 60e3, tries: 0 } }, { upsert: true });
    const sent = await sendMail(email, code);
    if (!sent && !process.env.VERCEL) devCode = code; // hanya untuk uji lokal
  }
  res.json({ ok: true, devCode }); // respons sama baik email terdaftar maupun tidak
}));

app.post('/api/reset', wrap(async (req, res) => {
  const { email: e = '', code = '', password = '' } = req.body || {};
  const email = String(e).toLowerCase().trim();
  if (password.length < 6) return res.status(400).json({ error: 'Kata sandi baru minimal 6 karakter.' });
  const db = await getDB();
  const r = await db.collection('resets').findOne({ email });
  const bad = () => res.status(400).json({ error: 'Kode salah atau sudah kedaluwarsa.' });
  if (!r || r.exp < Date.now() || r.tries >= 5) return bad();
  const good = hashCode(email, String(code).trim());
  if (good.length !== r.hash.length || !crypto.timingSafeEqual(Buffer.from(good), Buffer.from(r.hash))) {
    await db.collection('resets').updateOne({ email }, { $inc: { tries: 1 } });
    return bad();
  }
  await db.collection('users').updateOne({ email }, { $set: { password: hashPassword(password) } });
  await db.collection('resets').deleteOne({ email });
  res.json({ ok: true });
}));

module.exports = app;
