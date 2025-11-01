// api/src/index.js
require('dotenv').config();
const express = require('express');
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
    host: process.env.PG_HOST || '127.0.0.1', // évite la résolution IPv6 (::1)
    user: process.env.PG_USER || 'admin',
    password: process.env.PG_PASSWORD || 'admin',
    database: process.env.PG_DATABASE || 'sweetcake',
    port: process.env.PG_PORT ? parseInt(process.env.PG_PORT, 10) : 5432,
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

    // GET commandes (sans lignes)
    app.get('/commandes', async (req, res) => {
        try {
            const result = await pool.query('SELECT * FROM commandes ORDER BY id_commande');
            return res.json(result.rows);
        } catch (err) {
            console.error(err);
            return res.status(500).json({ error: 'Erreur serveur' });
        }
    })

    /* --- PostgreSQL CRUD: commandes (transaction pour création) --- */
    // GET commandes (avec lignes)
    // javascript
    app.get('/commandes-produits', async (req, res) => {
        try {
            const q = `
      SELECT
        c.id_commande,
        c.date_commande,
        c.total,
        c.id_client,
        COALESCE(
          json_agg(
            json_build_object(
              'id_produit_commande', pc.id_produit_commande,
              'id_produit', pc.id_produit,
              'quantite_produit', pc.quantite_produit,
              'nom', p.nom,
              'prix', p.prix
            )
          ) FILTER (WHERE pc.id_produit_commande IS NOT NULL),
          '[]'
        ) AS items
      FROM commandes c
      LEFT JOIN produit_commande pc ON pc.id_commande = c.id_commande
      LEFT JOIN produits p ON p.id_produit = pc.id_produit
      GROUP BY c.id_commande, c.date_commande, c.total, c.id_client
      ORDER BY c.id_commande;
    `;
            const result = await pool.query(q);
            return res.json(result.rows);
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
            return res.status(400).json({ error: 'id_client et items (non vide) requis' });
        }

        const clientPg = await pool.connect();
        try {
            await clientPg.query('BEGIN');

            // Créer la commande (date_commande automatique, total temporaire 0)
            const insertCmd = await clientPg.query(
                `INSERT INTO commandes (id_client, date_commande, total)
       VALUES ($1, NOW(), 0) RETURNING id_commande`,
                [id_client]
            );
            const id_commande = insertCmd.rows[0].id_commande;

            // Insérer les lignes et mettre à jour le stock, calculer le total
            let total = 0;
            for (const it of items) {
                const { id_produit, quantite_produit } = it;
                if (!id_produit || !Number.isInteger(quantite_produit) || quantite_produit <= 0) {
                    throw new Error('Item invalide');
                }

                // Récupérer le prix et le stock du produit
                const prodRes = await clientPg.query(
                    `SELECT prix, quantite_stock FROM produits WHERE id_produit = $1 FOR UPDATE`,
                    [id_produit]
                );
                if (prodRes.rowCount === 0) throw new Error(`Produit ${id_produit} introuvable`);
                const { prix, quantite_stock } = prodRes.rows[0];

                if (quantite_stock < quantite_produit) {
                    throw new Error(`Stock insuffisant pour le produit ${id_produit}`);
                }

                // Insérer la ligne sans référencer prix_unitaire
                await clientPg.query(
                    `INSERT INTO produit_commande (id_commande, id_produit, quantite_produit)
         VALUES ($1, $2, $3)`,
                    [id_commande, id_produit, quantite_produit]
                );

                // Décrémenter le stock
                await clientPg.query(
                    `UPDATE produits SET quantite_stock = quantite_stock - $1 WHERE id_produit = $2`,
                    [quantite_produit, id_produit]
                );

                total += parseFloat(prix) * quantite_produit;
            }

            // Mettre à jour le total de la commande
            await clientPg.query(
                `UPDATE commandes SET total = $1 WHERE id_commande = $2`,
                [total, id_commande]
            );

            await clientPg.query('COMMIT');
            return res.status(201).json({ id_commande, total });
        } catch (err) {
            await clientPg.query('ROLLBACK');
            console.error(err);
            return res.status(500).json({ error: err.message || 'Erreur serveur' });
        } finally {
            clientPg.release();
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