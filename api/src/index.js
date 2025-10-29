// api/src/index.js
require('dotenv').config();
const express = require('express');
const { initPostgres, initMongo } = require('./db');
const { MongoClient } = require('mongodb');
const { Pool } = require('pg');


const app = express();
app.use(express.json());
app.use((req, res, next) => {
    console.log(`[HTTP] ${new Date().toISOString()} ${req.method} ${req.url}`);
    next();
});
const port = process.env.PORT || 3000;

const MONGO_URI = 'mongodb://admin:password@mongo:27017/?authSource=admin';
const DB_NAME = 'sweetcake';

let mongoDb

const pool = new Pool({
    host: 'localhost',
    user: 'admin',
    password: 'admin',
    database: 'sweetcake',
    port: 5432,
});

async function start() {
    const client = new MongoClient(MONGO_URI, {useUnifiedTopology: true});
    await client.connect();
    const db = client.db(DB_NAME);

    app.get('/', (req, res) => res.json({ ok: true, uptime: process.uptime() }));

    app.post('/recettes', async (req, res) => {
        try {
            const {productId, ingredients, etapes, createdBy, createdAt} = req.body;

            if (!productId || !Array.isArray(ingredients) || ingredients.length === 0 ||
                !Array.isArray(etapes) || etapes.length === 0 || !createdBy) {
                return res.status(400).json({error: 'Champs requis manquants ou invalides'});
            }

            const doc = {
                productId,
                ingredients,
                etapes,
                createdBy,
                createdAt: createdAt ? new Date(createdAt) : new Date()
            };

            const result = await db.collection('recette').insertOne(doc);
            return res.status(201).json({insertedId: result.insertedId});
        } catch (err) {
            console.error(err);
            return res.status(500).json({error: 'Erreur serveur'});
        }
    });

    app.post('/avis', async (req, res) => {
        try {
            const {productId, clientId, commentaire, dateDePublication, note} = req.body;

            if (!productId || !clientId || !commentaire) {
                return res.status(400).json({error: 'Champs requis manquants'});
            }
            if (note !== undefined && (typeof note !== 'number' || note < 1 || note > 5)) {
                return res.status(400).json({error: 'Note doit être un entier entre 1 et 5'});
            }

            const doc = {
                productId,
                clientId,
                commentaire,
                dateDePublication: dateDePublication ? new Date(dateDePublication) : new Date(),
                ...(note !== undefined ? {note} : {})
            };

            const result = await db.collection('avis').insertOne(doc);
            return res.status(201).json({insertedId: result.insertedId});
        } catch (err) {
            console.error(err);
            return res.status(500).json({error: 'Erreur serveur'});
        }
    });

    app.post('/clients', async (req, res) => {
        const { nom, email, adresse, telephone } = req.body;
        try {
            const result = await pool.query(
                'INSERT INTO clients (nom, email, adresse, telephone) VALUES ($1,$2,$3,$4) RETURNING *',
                [nom, email, adresse, telephone]
            );
            return res.status(201).json(result.rows[0]);
        } catch (err) {
            console.error(err);
            if (err.code === '23505') return res.status(409).json({ error: 'Email déjà utilisé' });
            return res.status(500).json({ error: 'Erreur serveur' });
        }
    });

    app.get('/clients', async (req, res) => {
        try {
            const result = await pool.query('SELECT * FROM clients ORDER BY id_client');
            return res.json(result.rows);
        } catch (err) {
            console.error(err);
            return res.status(500).json({ error: 'Erreur serveur' });
        }
    });

    app.get('/clients/:id', async (req, res) => {
        try {
            const result = await pool.query('SELECT * FROM clients WHERE id_client = $1', [req.params.id]);
            if (result.rows.length === 0) return res.status(404).json({ error: 'Client non trouvé' });
            return res.json(result.rows[0]);
        } catch (err) {
            console.error(err);
            return res.status(500).json({ error: 'Erreur serveur' });
        }
    });

    app.put('/clients/:id', async (req, res) => {
        const { nom, email, adresse, telephone } = req.body;
        try {
            const result = await pool.query(
                'UPDATE clients SET nom = COALESCE($1, nom), email = COALESCE($2, email), adresse = COALESCE($3, adresse), telephone = COALESCE($4, telephone) WHERE id_client = $5 RETURNING *',
                [nom, email, adresse, telephone, req.params.id]
            );
            if (result.rows.length === 0) return res.status(404).json({ error: 'Client non trouvé' });
            return res.json(result.rows[0]);
        } catch (err) {
            console.error(err);
            if (err.code === '23505') return res.status(409).json({ error: 'Email déjà utilisé' });
            return res.status(500).json({ error: 'Erreur serveur' });
        }
    });

    app.delete('/clients/:id', async (req, res) => {
        try {
            const result = await pool.query('DELETE FROM clients WHERE id_client = $1 RETURNING *', [req.params.id]);
            if (result.rows.length === 0) return res.status(404).json({ error: 'Client non trouvé' });
            return res.json({ deleted: true });
        } catch (err) {
            console.error(err);
            return res.status(500).json({ error: 'Erreur serveur' });
        }
    });

    /* --- PostgreSQL CRUD: produits --- */
    app.post('/produits', async (req, res) => {
        const { nom, categorie, description, prix, quantite_stock } = req.body;
        try {
            const result = await pool.query(
                'INSERT INTO produits (nom, categorie, description, prix, quantite_stock) VALUES ($1,$2,$3,$4,$5) RETURNING *',
                [nom, categorie, description, prix, quantite_stock]
            );
            return res.status(201).json(result.rows[0]);
        } catch (err) {
            console.error(err);
            return res.status(500).json({ error: 'Erreur serveur' });
        }
    });

    app.get('/produits', async (req, res) => {
        try {
            const result = await pool.query('SELECT * FROM produits ORDER BY id_produit');
            return res.json(result.rows);
        } catch (err) {
            console.error(err);
            return res.status(500).json({ error: 'Erreur serveur' });
        }
    });

    app.get('/produits/:id', async (req, res) => {
        try {
            const result = await pool.query('SELECT * FROM produits WHERE id_produit = $1', [req.params.id]);
            if (result.rows.length === 0) return res.status(404).json({ error: 'Produit non trouvé' });
            return res.json(result.rows[0]);
        } catch (err) {
            console.error(err);
            return res.status(500).json({ error: 'Erreur serveur' });
        }
    });

    app.put('/produits/:id', async (req, res) => {
        const { nom, categorie, description, prix, quantite_stock } = req.body;
        try {
            const result = await pool.query(
                'UPDATE produits SET nom = COALESCE($1, nom), categorie = COALESCE($2, categorie), description = COALESCE($3, description), prix = COALESCE($4, prix), quantite_stock = COALESCE($5, quantite_stock) WHERE id_produit = $6 RETURNING *',
                [nom, categorie, description, prix, quantite_stock, req.params.id]
            );
            if (result.rows.length === 0) return res.status(404).json({ error: 'Produit non trouvé' });
            return res.json(result.rows[0]);
        } catch (err) {
            console.error(err);
            return res.status(500).json({ error: 'Erreur serveur' });
        }
    });

    app.delete('/produits/:id', async (req, res) => {
        try {
            const result = await pool.query('DELETE FROM produits WHERE id_produit = $1 RETURNING *', [req.params.id]);
            if (result.rows.length === 0) return res.status(404).json({ error: 'Produit non trouvé' });
            return res.json({ deleted: true });
        } catch (err) {
            console.error(err);
            return res.status(500).json({ error: 'Erreur serveur' });
        }
    });

    /* --- PostgreSQL CRUD: commandes (transaction pour création) --- */
    // GET commandes (avec lignes)
    app.get('/commandes', async (req, res) => {
        try {
            const commandesRes = await pool.query('SELECT * FROM commandes ORDER BY id_commande');
            const commandes = [];
            for (const c of commandesRes.rows) {
                const itemsRes = await pool.query(
                    `SELECT pc.id_produit_commande, pc.id_produit, pc.quantite_produit, pc.prix_unitaire, p.nom
           FROM produit_commande pc JOIN produits p ON p.id_produit = pc.id_produit WHERE pc.id_commande = $1`,
                    [c.id_commande]
                );
                commandes.push({ ...c, items: itemsRes.rows });
            }
            return res.json(commandes);
        } catch (err) {
            console.error(err);
            return res.status(500).json({ error: 'Erreur serveur' });
        }
    });

    app.get('/commandes/:id', async (req, res) => {
        try {
            const cRes = await pool.query('SELECT * FROM commandes WHERE id_commande = $1', [req.params.id]);
            if (cRes.rows.length === 0) return res.status(404).json({ error: 'Commande non trouvée' });
            const c = cRes.rows[0];
            const itemsRes = await pool.query(
                `SELECT pc.id_produit_commande, pc.id_produit, pc.quantite_produit, pc.prix_unitaire, p.nom
         FROM produit_commande pc JOIN produits p ON p.id_produit = pc.id_produit WHERE pc.id_commande = $1`,
                [c.id_commande]
            );
            return res.json({ ...c, items: itemsRes.rows });
        } catch (err) {
            console.error(err);
            return res.status(500).json({ error: 'Erreur serveur' });
        }
    });

    // POST commande with items array [{ id_produit, quantite_produit }]
    app.post('/commandes', async (req, res) => {
        const { id_client, items } = req.body;
        if (!id_client || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'id_client et items requis' });
        }

        const client = await pool.query('SELECT id_client FROM clients WHERE id_client = $1', [id_client]);
        if (client.rows.length === 0) return res.status(400).json({ error: 'Client invalide' });

        const clientConn = await pool.connect();
        try {
            await clientConn.query('BEGIN');

            // create commande
            const cRes = await clientConn.query(
                'INSERT INTO commandes (id_client, total) VALUES ($1, 0) RETURNING *',
                [id_client]
            );
            const id_commande = cRes.rows[0].id_commande;

            let total = 0;
            for (const it of items) {
                const { id_produit, quantite_produit } = it;
                if (!id_produit || !quantite_produit || quantite_produit <= 0) {
                    throw { status: 400, message: 'Item invalide' };
                }
                const pRes = await clientConn.query('SELECT prix, quantite_stock FROM produits WHERE id_produit = $1 FOR UPDATE', [id_produit]);
                if (pRes.rows.length === 0) throw { status: 400, message: `Produit ${id_produit} introuvable` };
                const produit = pRes.rows[0];
                if (produit.quantite_stock < quantite_produit) throw { status: 400, message: `Stock insuffisant pour produit ${id_produit}` };

                const prix_unitaire = produit.prix;
                await clientConn.query(
                    'INSERT INTO produit_commande (id_commande, id_produit, quantite_produit, prix_unitaire) VALUES ($1,$2,$3,$4)',
                    [id_commande, id_produit, quantite_produit, prix_unitaire]
                );
                await clientConn.query(
                    'UPDATE produits SET quantite_stock = quantite_stock - $1 WHERE id_produit = $2',
                    [quantite_produit, id_produit]
                );
                total += parseFloat(prix_unitaire) * parseInt(quantite_produit, 10);
            }

            await clientConn.query('UPDATE commandes SET total = $1 WHERE id_commande = $2', [total.toFixed(2), id_commande]);
            await clientConn.query('COMMIT');

            const created = await pool.query('SELECT * FROM commandes WHERE id_commande = $1', [id_commande]);
            return res.status(201).json({ commande: created.rows[0] });
        } catch (err) {
            await clientConn.query('ROLLBACK');
            console.error(err);
            if (err && err.status) return res.status(err.status).json({ error: err.message });
            return res.status(500).json({ error: 'Erreur serveur' });
        } finally {
            clientConn.release();
        }
    });

    app.put('/commandes/:id', async (req, res) => {
        const { date_commande, id_client } = req.body;
        try {
            const result = await pool.query(
                'UPDATE commandes SET date_commande = COALESCE($1, date_commande), id_client = COALESCE($2, id_client) WHERE id_commande = $3 RETURNING *',
                [date_commande, id_client, req.params.id]
            );
            if (result.rows.length === 0) return res.status(404).json({ error: 'Commande non trouvée' });
            return res.json(result.rows[0]);
        } catch (err) {
            console.error(err);
            return res.status(500).json({ error: 'Erreur serveur' });
        }
    });

    app.delete('/commandes/:id', async (req, res) => {
        try {
            const result = await pool.query('DELETE FROM commandes WHERE id_commande = $1 RETURNING *', [req.params.id]);
            if (result.rows.length === 0) return res.status(404).json({ error: 'Commande non trouvée' });
            return res.json({ deleted: true });
        } catch (err) {
            console.error(err);
            return res.status(500).json({ error: 'Erreur serveur' });
        }
    });

    /* --- CRUD simple pour produit_commande si besoin --- */
    app.get('/lignes/:id', async (req, res) => {
        try {
            const r = await pool.query('SELECT * FROM produit_commande WHERE id_produit_commande = $1', [req.params.id]);
            if (r.rows.length === 0) return res.status(404).json({ error: 'Ligne non trouvée' });
            return res.json(r.rows[0]);
        } catch (err) {
            console.error(err);
            return res.status(500).json({ error: 'Erreur serveur' });
        }
    });


    app.listen(port, () => {
        console.log('API started on port', port);
    });
}

start().catch(err => {
    console.error('Impossible de démarrer le serveur', err);
    process.exit(1);
});