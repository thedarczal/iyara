// Hanya untuk menjalankan di komputer sendiri (npm start). Vercel memakai api/index.js.
const express = require('express');
const path = require('path');
const app = require('./api/index');
app.use(express.static(path.join(__dirname, 'public')));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Berjalan di http://localhost:${PORT}`));
