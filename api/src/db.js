// api/src/db.js
const { Pool } = require('pg');
const mongoose = require('mongoose');

let pgPool;

function initPostgres() {
    if (pgPool) return pgPool;
    pgPool = new Pool({
        user: process.env.PG_USER,
        host: process.env.PG_HOST,
        database: process.env.PG_DATABASE,
        password: process.env.PG_PASSWORD,
        port: Number(process.env.PG_PORT || 5432)
    });
    return pgPool;
}

async function initMongo() {
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error('MONGO_URI non défini');
    if (mongoose.connection.readyState === 1) return mongoose;
    await mongoose.connect(uri, { dbName: process.env.MONGO_DB || 'sweetshop' });
    return mongoose;
}

module.exports = { initPostgres, initMongo };
