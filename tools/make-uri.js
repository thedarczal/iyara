// Membuat MONGODB_URI yang benar (password otomatis di-encode).
// Pakai: npm run make-uri   (atau: node tools/make-uri.js USER PASSWORD HOST)
const readline = require('readline');
function build(user, pass, host) {
  host = host.replace(/^mongodb(\+srv)?:\/\//, '').replace(/\/.*$/, '').trim();
  return `mongodb+srv://${encodeURIComponent(user.trim())}:${encodeURIComponent(pass)}@${host}/?retryWrites=true&w=majority`;
}
if (require.main === module) {
  const [u, p, h] = process.argv.slice(2);
  if (u && p && h) return console.log('\n' + build(u, p, h) + '\n');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = q => new Promise(r => rl.question(q, r));
  (async () => {
    const user = await ask('Username database : ');
    const pass = await ask('Password database : ');
    const host = await ask('Host cluster (mis. cluster0.abcde.mongodb.net): ');
    rl.close();
    console.log('\nSalin teks di bawah ini ke kolom Value MONGODB_URI di Vercel:\n\n' + build(user, pass, host) + '\n');
  })();
}
module.exports = { build };
