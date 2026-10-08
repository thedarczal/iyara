const $ = id => document.getElementById(id);
const token = () => localStorage.getItem('token');
let mode = 'login', imageFile = null, me = {}, netStarted = false;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function api(url, method = 'GET', body) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (token() || '') },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token() && !url.includes('/password')) logout();
  if (!res.ok) throw new Error(data.error || 'Terjadi kesalahan.');
  return data;
}

/* ---------- Efek: toast, percikan klik, riak, cahaya kursor, jaringan ---------- */
function toast(msg) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
  $('toasts').appendChild(t);
  const a = t.animate([{ opacity: 0, transform: 'translateY(16px) scale(.95)' }, { opacity: 1, transform: 'none' }], { duration: 300, easing: 'cubic-bezier(.2,.8,.2,1)' });
  setTimeout(() => t.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(10px)' }], { duration: 300 }).onfinish = () => t.remove(), 2600);
}
function burst(x, y) {
  const cols = ['#52b069', '#2f80ed', '#b5e86a', '#7fd6e6'];
  for (let i = 0; i < 14; i++) {
    const p = document.createElement('i'); p.className = 'sp';
    p.style.cssText = `left:${x}px;top:${y}px;background:${cols[i % 4]}`;
    document.body.appendChild(p);
    const a = Math.random() * 6.28, d = 40 + Math.random() * 60;
    p.animate([{ transform: 'translate(-50%,-50%) scale(1)', opacity: 1 }, { transform: `translate(${Math.cos(a) * d}px,${Math.sin(a) * d}px) scale(0)`, opacity: 0 }],
      { duration: 550 + Math.random() * 300, easing: 'cubic-bezier(.2,.8,.2,1)' }).onfinish = () => p.remove();
  }
}
function ripple(btn, x, y) {
  const r = btn.getBoundingClientRect(), s = Math.max(r.width, r.height), el = document.createElement('span');
  el.className = 'ripple';
  el.style.cssText = `width:${s}px;height:${s}px;left:${x - r.left - s / 2}px;top:${y - r.top - s / 2}px`;
  btn.appendChild(el); setTimeout(() => el.remove(), 700);
}
document.addEventListener('pointerdown', e => {
  const t = e.target.closest('button,.drop,.avatar-big,.card3');
  if (!t || t.disabled) return;
  burst(e.clientX, e.clientY);
  const b = t.closest('.btn'); if (b) ripple(b, e.clientX, e.clientY);
});
document.addEventListener('pointermove', e => {
  $('glow').style.transform = `translate(${e.clientX}px,${e.clientY}px)`;
  const b = e.target.closest('.btn');
  if (b) { const r = b.getBoundingClientRect(); b.style.setProperty('--x', e.clientX - r.left + 'px'); b.style.setProperty('--y', e.clientY - r.top + 'px'); }
  const c = e.target.closest('.card3');
  if (c) { const r = c.getBoundingClientRect(); c.style.transform = `perspective(600px) rotateY(${((e.clientX - r.left) / r.width - .5) * 10}deg) rotateX(${-((e.clientY - r.top) / r.height - .5) * 10}deg) translateY(-4px)`; }
});
document.addEventListener('pointerout', e => { const c = e.target.closest('.card3'); if (c) c.style.transform = ''; });

function netBG(c) { // jaringan titik yang bergerak & menjauhi kursor
  const x = c.getContext('2d'); let w, h, pts = [], mx = -999, my = -999;
  const fit = () => { w = c.width = c.offsetWidth; h = c.height = c.offsetHeight;
    pts = Array.from({ length: Math.min(70, Math.round(w * h / 13000)) }, () => ({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - .5) * .4, vy: (Math.random() - .5) * .4 })); };
  fit(); addEventListener('resize', fit);
  c.parentElement.addEventListener('pointermove', e => { const r = c.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top; });
  (function loop() {
    x.clearRect(0, 0, w, h);
    for (const p of pts) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > w) p.vx *= -1; if (p.y < 0 || p.y > h) p.vy *= -1;
      const dx = p.x - mx, dy = p.y - my, d = Math.hypot(dx, dy);
      if (d < 110 && d > 0) { p.x += dx / d * 1.6; p.y += dy / d * 1.6; }
    }
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
        if (d < 110) { x.strokeStyle = `rgba(127,214,230,${.35 * (1 - d / 110)})`; x.beginPath(); x.moveTo(pts[i].x, pts[i].y); x.lineTo(pts[j].x, pts[j].y); x.stroke(); }
      }
      x.fillStyle = '#7fd6e6'; x.beginPath(); x.arc(pts[i].x, pts[i].y, 2, 0, 7); x.fill();
    }
    requestAnimationFrame(loop);
  })();
}
netBG($('auth-net'));

/* ---------- Masuk / Daftar / Lupa & Atur ulang sandi ---------- */
const LABEL = { login: 'Masuk', register: 'Buat akun', forgot: 'Kirim kode', reset: 'Atur ulang sandi' };
function setMode(m) {
  mode = m;
  document.querySelectorAll('#auth-form [data-m]').forEach(el => el.classList.toggle('hide', !el.dataset.m.split(' ').includes(m)));
  const fr = m === 'forgot' || m === 'reset';
  $('tabs').classList.toggle('hide', fr); $('auth-head').classList.toggle('hide', !fr);
  $('tabs').classList.toggle('reg', m === 'register');
  $('tab-login').classList.toggle('active', m !== 'register'); $('tab-register').classList.toggle('active', m === 'register');
  $('auth-title').textContent = m === 'forgot' ? 'Lupa kata sandi' : 'Atur ulang kata sandi';
  $('auth-desc').textContent = m === 'forgot' ? 'Masukkan email akun Anda. Kami kirim kode 6 digit.' : 'Masukkan kode dari email dan kata sandi baru.';
  $('password').placeholder = m === 'reset' ? 'Kata sandi baru (min. 6 karakter)' : 'Kata sandi (min. 6 karakter)';
  $('password').autocomplete = m === 'login' ? 'current-password' : 'new-password';
  $('auth-submit').querySelector('.label').textContent = LABEL[m];
  $('auth-error').textContent = ''; $('auth-info').textContent = '';
}
setMode('login');
$('tab-login').onclick = () => setMode('login');
$('tab-register').onclick = () => setMode('register');
$('forgot-link').onclick = () => setMode('forgot');
$('back').onclick = () => setMode('login');

$('auth-form').addEventListener('keydown', e => { // Enter -> tombol tampak tertekan
  if (e.key !== 'Enter') return;
  const b = $('auth-submit'), r = b.getBoundingClientRect();
  b.classList.add('pressed'); ripple(b, r.left + r.width / 2, r.top + r.height / 2); burst(r.left + r.width / 2, r.top + r.height / 2);
  setTimeout(() => b.classList.remove('pressed'), 180);
});
async function finish(btn) { btn.classList.replace('loading', 'done'); await sleep(650); btn.classList.remove('done'); }

$('auth-form').onsubmit = async e => {
  e.preventDefault();
  const btn = $('auth-submit'), f = $('auth-form');
  btn.classList.add('loading'); $('auth-error').textContent = ''; $('auth-info').textContent = '';
  const body = { name: $('name').value, email: $('email').value, password: $('password').value, code: $('code').value };
  try {
    if (mode === 'forgot') {
      const r = await api('/api/forgot', 'POST', { email: body.email });
      await finish(btn); setMode('reset');
      $('auth-info').textContent = r.devCode ? `Mode lokal: kode Anda ${r.devCode}` : 'Jika email terdaftar, kode sudah dikirim (berlaku 15 menit).';
      return;
    }
    if (mode === 'reset') {
      await api('/api/reset', 'POST', body);
      await finish(btn); setMode('login'); $('password').value = '';
      $('auth-info').textContent = 'Kata sandi berhasil diubah. Silakan masuk.';
      return;
    }
    const [data] = await Promise.all([api('/api/' + mode, 'POST', body), sleep(500)]);
    localStorage.setItem('token', data.token); localStorage.setItem('name', data.name);
    btn.classList.replace('loading', 'done');
    const r = btn.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2);
    await sleep(800);
    $('auth').classList.add('leave'); await sleep(450);
    await showApp(true);
    btn.classList.remove('done'); $('auth').classList.remove('leave');
  } catch (err) {
    btn.classList.remove('loading');
    $('auth-error').textContent = err.message;
    f.classList.remove('shake'); void f.offsetWidth; f.classList.add('shake');
  }
};

function logout() {
  localStorage.clear(); me = {};
  $('app').hidden = true; $('auth').hidden = false;
  $('auth-form').reset(); setMode('login');
}
$('logout').onclick = logout;

/* ---------- Navigasi antar tampilan ---------- */
const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .15 });
function observeRv() {
  document.querySelectorAll('.view:not([hidden]) :is(.rv,.stg):not(.in)').forEach(el => io.observe(el));
}
function go(v) {
  document.querySelectorAll('.view').forEach(s => s.hidden = s.id !== 'v-' + v);
  document.querySelectorAll('.top nav button').forEach(b => b.classList.toggle('active', b.dataset.v === v));
  const s = $('v-' + v); s.classList.remove('enter'); void s.offsetWidth; s.classList.add('enter');
  scrollTo({ top: 0, behavior: 'smooth' });
  if (v === 'history') loadHistory();
  observeRv();
}
document.addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (b) go(b.dataset.v); });

/* ---------- Beranda (isi dari PPT proposal) ---------- */
function renderLanding() {
  const li = (arr, f) => arr.map((t, i) => f(t, i)).join('');
  const PIPE = [['INPUT', 'Gambar daun'], ['IMAGE PROCESSING', 'Normalisasi & segmentasi'], ['CNN / DEEP LEARNING', 'Ekstraksi pola visual'], ['PREDIKSI', 'Kondisi & confidence']];
  $('landing').innerHTML = `
  <section class="sec"><p class="kick">Latar belakang</p><h2 class="rv">Dari gejala visual menjadi sinyal keputusan.</h2>
    <div class="cards stg">
      ${li([['Daun sehat', 'Warna merata, permukaan utuh.'], ['Gejala penyakit', 'Perubahan warna, bercak, tekstur, atau kerusakan permukaan.'], ['Analisis AI', 'Pengolahan citra dan AI untuk pemeriksaan awal yang cepat dan konsisten.']], (c, i) => `<div class="card3 ${i == 2 ? 'g' : ''}" style="--i:${i}"><span class="n">${i + 1}</span><b>${c[0]}</b>${c[1]}</div>`)}
    </div>
    <p class="rv" style="max-width:62ch;margin-top:1.2rem;color:var(--muted)">Penyakit menurunkan pertumbuhan dan produktivitas. Kemiripan gejala membuat identifikasi manual terbatas.</p></section>

  <section class="sec"><div class="darkbox"><p class="kick">Konsep teknologi</p><h2 class="rv">Foto masuk. Insight keluar.</h2>
    <div class="cards stg">${li(PIPE, (p, i) => `<div class="pbox" style="--i:${i}">${p[0]}<small>${p[1]}</small></div>`)}</div></div></section>

  <section class="sec"><p class="kick">Empat pertanyaan kunci</p><h2 class="rv">Apa yang ingin dijawab?</h2>
    <div class="cards stg">${li(['Bagaimana merancang sistem berbasis citra daun?', 'Bagaimana menyiapkan data latih dan data uji?', 'Bagaimana menguji kemampuan membedakan daun sehat dan sakit?', 'Bagaimana menyajikan prediksi agar mudah dipahami?'], (q, i) => `<div class="card3 ${i == 0 ? 'g' : ''}" style="--i:${i}"><span class="n">${i + 1}</span><b>${q}</b></div>`)}</div></section>

  <section class="sec"><p class="kick">Tujuan dan manfaat</p><h2 class="rv">Untuk apa sistem ini?</h2>
    <div class="two stg"><div style="--i:0"><b>TUJUAN</b><ul>${li(['Membangun prototipe berbasis citra daun', 'Menjalankan data, preprocessing, pelatihan, dan uji', 'Mengukur accuracy, precision, recall, dan confusion matrix'], t => `<li>${t}</li>`)}</ul></div>
    <div style="--i:1"><b>MANFAAT</b><ul>${li(['Identifikasi awal kondisi daun', 'Penerapan AI di bidang pertanian', 'Media pembelajaran machine learning'], t => `<li>${t}</li>`)}</ul></div></div></section>

  <section class="sec"><p class="kick">Metode pelaksanaan</p><h2 class="rv">Dari kebutuhan menuju prototipe yang terukur.</h2>
    <div class="cards stg">${li(['Identifikasi kebutuhan', 'Pengumpulan & persiapan data', 'Perancangan sistem', 'Pengembangan prototipe', 'Pengujian sistem', 'Evaluasi & penyempurnaan'], (t, i) => `<div class="card3 ${i < 2 ? 'g' : ''}" style="--i:${i}"><span class="n">${i + 1}</span><b>${t}</b></div>`)}</div></section>

  <section class="sec"><p class="kick">Pengujian sistem</p><h2 class="rv">Ilustrasi dashboard evaluasi</h2>
    <div class="stg"><div style="--i:0">${li([['Accuracy', 92], ['Precision', 89], ['Recall', 91], ['F1-score', 90]], m => `<div class="mbar"><span>${m[0]}</span><div><i style="--w:${m[1]}%"></i></div><span>${m[1]}%</span></div>`)}
    <p class="muted" style="font-size:.85rem">Angka di atas adalah ilustrasi/target dari proposal, bukan hasil uji prototipe ini.</p></div></div></section>

  <section class="sec"><p class="kick">Luaran yang diharapkan</p><h2 class="rv">Hasil akhir proyek</h2>
    <div class="cards stg">${li(['Prototype sistem', 'Dataset terdokumentasi', 'Laporan pengujian', 'Artikel ilmiah', 'Dokumentasi sistem'], (t, i) => `<div class="card3 ${i == 4 ? 'g' : ''}" style="--i:${i}"><span class="n">0${i + 1}</span><b>${t}</b></div>`)}</div></section>`;
  observeRv();
}

/* ---------- Profil & foto ---------- */
function paintAvatar() {
  const ini = (me.name || '?')[0].toUpperCase();
  [$('nav-av'), $('pf-av')].forEach(el => { el.style.backgroundImage = me.avatar ? `url(${me.avatar})` : ''; el.textContent = me.avatar ? '' : ini; });
}
async function loadMe() {
  me = await api('/api/me'); localStorage.setItem('name', me.name);
  $('who').textContent = me.name; $('pf-email').textContent = me.email;
  $('pf-name').value = me.name; $('pf-inst').value = me.institution; $('pf-bio').value = me.bio;
  paintAvatar();
}
function squareDataURL(file, size) {
  return loadImage(file).then(img => {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const s = Math.min(img.width, img.height);
    c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
    return c.toDataURL('image/jpeg', .82);
  });
}
$('av-file').onchange = async e => {
  const f = e.target.files[0]; if (!f || !f.type.startsWith('image/')) return;
  me.avatar = await squareDataURL(f, 220); paintAvatar();
  const a = $('pf-av'); a.animate([{ transform: 'scale(.8)', opacity: .4 }, { transform: 'scale(1)', opacity: 1 }], { duration: 500, easing: 'cubic-bezier(.3,1.6,.5,1)' });
  toast('Foto dipilih — klik "Simpan profil"');
};
document.querySelector('.avatar-big').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('av-file').click(); } });
async function submitBtn(btn, fn, okMsg) {
  btn.classList.add('loading');
  try { await fn(); btn.classList.replace('loading', 'done'); const r = btn.getBoundingClientRect(); burst(r.left + r.width / 2, r.top); toast(okMsg); await sleep(800); }
  catch (err) { toast(err.message); }
  btn.classList.remove('loading', 'done');
}
$('pf-form').onsubmit = e => { e.preventDefault(); submitBtn($('pf-save'), async () => {
  me = await api('/api/me', 'PUT', { name: $('pf-name').value, institution: $('pf-inst').value, bio: $('pf-bio').value, avatar: me.avatar || '' });
  localStorage.setItem('name', me.name); $('who').textContent = me.name; paintAvatar();
}, 'Profil tersimpan ✓'); };
$('pw-form').onsubmit = e => { e.preventDefault(); submitBtn($('pw-save'), async () => {
  await api('/api/me/password', 'PUT', { current: $('pw-cur').value, password: $('pw-new').value }); $('pw-form').reset();
}, 'Kata sandi diubah ✓'); };

async function showApp(anim) {
  try { await loadMe(); } catch { return; }
  $('auth').hidden = true; $('app').hidden = false;
  if (anim) $('app').classList.add('enter');
  if (!netStarted) { netStarted = true; netBG($('app-net')); }
  renderLanding(); go('home');
}

/* ---------- Upload foto ---------- */
function setFile(f) {
  if (!f || !f.type.startsWith('image/')) return;
  imageFile = f;
  $('preview').src = URL.createObjectURL(f);
  $('preview').hidden = false; $('drop-hint').hidden = true;
  $('analyze').disabled = false; $('result').hidden = true;
  document.querySelectorAll('#pipe li').forEach((li, i) => li.classList.toggle('on', i === 0));
}
$('file').onchange = e => setFile(e.target.files[0]);
$('drop').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('file').click(); } });
['dragover', 'dragenter'].forEach(ev => $('drop').addEventListener(ev, e => { e.preventDefault(); $('drop').classList.add('over'); }));
['dragleave', 'drop'].forEach(ev => $('drop').addEventListener(ev, () => $('drop').classList.remove('over')));
$('drop').addEventListener('drop', e => { e.preventDefault(); setFile(e.dataTransfer.files[0]); });

/* ---------- Analisis citra ----------
   PROTOTIPE: analisis warna piksel (hijau / kuning / cokelat) di browser.
   Untuk model CNN sungguhan, ganti fungsi analyzeImage() dengan pemanggilan
   endpoint prediksi (lihat README). */
function loadImage(file) {
  return new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = URL.createObjectURL(file); });
}
async function analyzeImage(file) {
  const img = await loadImage(file), S = 128;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, S, S);
  const px = ctx.getImageData(0, 0, S, S).data;
  let leaf = 0, green = 0, yellow = 0, brown = 0;
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i] / 255, g = px[i + 1] / 255, b = px[i + 2] / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    if (max < .12 || d / (max || 1) < .22) continue; // buang latar putih/abu/gelap
    let h = d === 0 ? 0 : max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
    leaf++;
    if (h >= 75 && h <= 165) green++;
    else if (h >= 42 && h < 75) yellow++;
    else if (h >= 8 && h < 42) brown++;
  }
  if (leaf < S * S * 0.04) return { condition: 'Daun tidak terdeteksi', confidence: 0, info: 'Gambar tidak memuat cukup area daun. Ambil foto dari dekat dengan latar polos dan cahaya cukup.' };
  const g = green / leaf, y = yellow / leaf, br = brown / leaf, sick = y + br;
  let condition, score, info;
  if (br >= .08 && br >= y * .6) { condition = 'Indikasi bercak / nekrosis'; score = Math.min(.55 + br * 2.2, .96); info = 'Terdeteksi area kecokelatan pada daun. Pisahkan daun terdampak, jaga sirkulasi udara, dan konsultasikan ke penyuluh pertanian untuk memastikan penyebabnya.'; }
  else if (y >= .12) { condition = 'Indikasi klorosis (menguning)'; score = Math.min(.55 + y * 2, .94); info = 'Terdeteksi area menguning. Dapat terkait kekurangan nutrisi, kelebihan air, atau infeksi. Periksa penyiraman dan nutrisi, lalu amati perkembangannya.'; }
  else if (g >= .85) { condition = 'Daun terlihat sehat'; score = Math.min(.6 + (g - .85) * 2.5, .97); info = 'Warna daun didominasi hijau merata. Tetap lakukan pemantauan rutin.'; }
  else { condition = 'Perlu pemeriksaan lanjut'; score = .5 + Math.min(sick, .1); info = 'Pola warna campuran sehingga hasil kurang pasti. Coba foto ulang dengan pencahayaan lebih baik atau minta bantuan ahli.'; }
  return { condition, confidence: Math.round(score * 100), info };
}
function thumbnail(file) {
  return loadImage(file).then(img => {
    const c = document.createElement('canvas'); c.width = c.height = 96;
    const s = Math.min(img.width, img.height);
    c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 96, 96);
    return c.toDataURL('image/jpeg', .7);
  });
}

$('analyze').onclick = async () => {
  const btn = $('analyze'), lis = [...document.querySelectorAll('#pipe li')];
  btn.classList.add('loading'); btn.disabled = true; $('result').hidden = true;
  for (let i = 0; i < lis.length - 1; i++) { lis.forEach((li, k) => li.classList.toggle('on', k <= i)); await sleep(650); }
  try {
    const res = await analyzeImage(imageFile);
    lis.forEach(li => li.classList.add('on'));
    $('res-title').textContent = res.condition;
    $('res-conf').textContent = 'Confidence ' + res.confidence + '%';
    $('res-info').textContent = res.info;
    $('res-bar').style.width = '0';
    $('result').hidden = false;
    { const r = $('analyze').getBoundingClientRect(); burst(r.left + r.width / 2, r.top); toast('Analisis selesai'); }
    requestAnimationFrame(() => requestAnimationFrame(() => $('res-bar').style.width = res.confidence + '%'));
    btn.classList.replace('loading', 'done');
    if (res.confidence > 0) {
      await api('/api/scans', 'POST', { condition: res.condition, confidence: res.confidence, thumb: await thumbnail(imageFile), note: res.info });
      loadHistory();
    }
    await sleep(900);
  } catch (e) { alert(e.message); }
  btn.classList.remove('loading', 'done'); btn.disabled = false;
};

/* ---------- Riwayat ---------- */
async function loadHistory() {
  const list = await api('/api/scans');
  $('empty').hidden = list.length > 0;
  $('history').innerHTML = '';
  list.forEach((s, i) => {
    const li = document.createElement('li');
    li.style.animationDelay = i * 60 + 'ms';
    li.innerHTML = '<img alt=""><div><b></b><small></small></div><button title="Hapus" aria-label="Hapus">✕</button>';
    li.querySelector('img').src = s.thumb;
    li.querySelector('b').textContent = s.condition;
    li.querySelector('small').textContent = s.confidence + '% · ' + new Date(s.createdAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
    li.querySelector('button').onclick = async () => { li.style.transition = 'all .3s'; li.style.opacity = 0; li.style.transform = 'scale(.9)'; await sleep(280); await api('/api/scans/' + s.id, 'DELETE'); loadHistory(); };
    $('history').appendChild(li);
  });
}


if (token()) showApp(false);
