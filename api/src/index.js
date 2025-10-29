// api/src/index.js
require('dotenv').config();
const express = require('express');
const { initPostgres, initMongo } = require('./db');

const app = express();
app.use(express.json());
const port = process.env.PORT || 3000;
// app.get('/health', (req, res) => res.json({ status: 'ok' }));
//
// app.get('/dbs/status', async (req, res) => {
//     try {
//         const pg = initPostgres();
//         const pgRes = await pg.query('SELECT 1 as ok');
//         await initMongo();
//         res.json({ postgres: pgRes.rows[0].ok === 1, mongo: true });
//     } catch (err) {
//         res.status(500).json({ error: err.message });
//     }
// });

app.listen(port, () => {
    console.log('API started on port', port);
});
