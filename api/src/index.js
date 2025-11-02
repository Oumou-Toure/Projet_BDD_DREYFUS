// api/src/index.js
require('dotenv').config();
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
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

async function productExists(idProduit) {
    const r = await pool.query('SELECT 1 FROM produits WHERE id_produit = $1', [idProduit]);
    return r.rowCount > 0;
}
async function clientExists(idClient) {
    const r = await pool.query('SELECT 1 FROM clients WHERE id_client = $1', [idClient]);
    return r.rowCount > 0;
}

async function start() {
    const client = new MongoClient(MONGO_URI, {useUnifiedTopology: true});
    await client.connect();
    const db = client.db(DB_NAME);

    app.get('/', (req, res) => res.json({ ok: true, uptime: process.uptime() }));

    app.get('/recettes', async (req, res) => {
        try {
            const q = {};
            if (req.query.productId) q.productId = parseInt(req.query.productId, 10);
            const rows = await db.collection('recette').find(q).toArray();
            return res.json(rows);
        } catch (err) {
            console.error(err);
            return res.status(500).json({ error: 'Erreur serveur' });
        }
    });

    app.get('/recettes/:id', async (req, res) => {
        try {
            const id = req.params.id;
            const collection = db.collection('recette');

            // 1) Si c'est un ObjectId Mongo valide -> recherche par _id
            if (ObjectId.isValid(id)) {
                const doc = await collection.findOne({ _id: new ObjectId(id) });
                if (doc) return res.json(doc);
                // si ObjectId valide mais pas trouvé, on continue pour tester fallback
            }

            // 2) Fallback : si c'est un entier -> recherche par productId (champ entier dans tes documents)
            const asInt = parseInt(id, 10);
            if (!Number.isNaN(asInt)) {
                const docs = await collection.find({ productId: asInt }).toArray();
                if (docs.length === 1) return res.json(docs[0]);
                if (docs.length > 1) return res.json(docs); // renvoie plusieurs recettes liées au même produit
                return res.status(404).json({ error: 'Recette non trouvée pour ce productId' });
            }

            // 3) Ni ObjectId ni entier -> id invalide
            return res.status(400).json({ error: 'Id invalide (ni ObjectId Mongo ni entier productId)' });
        } catch (err) {
            console.error(err);
            return res.status(500).json({ error: 'Erreur serveur' });
        }
    });

    app.post('/recettes', async (req, res) => {
        try {
            let { productId, ingredients, etapes, createdBy, createdAt } = req.body;

            // normaliser productId : entier si possible, sinon chaîne non vide
            const pid = parseInt(productId, 10);
            const productIdNorm = !isNaN(pid) ? pid : (typeof productId === 'string' && productId.trim() !== '' ? productId : null);
            if (productIdNorm === null) return res.status(400).json({ error: 'productId requis (int ou string)' });

            // createdBy -> forcer en string (validator accepte string ou int, mais ici on choisit string)
            if (createdBy === undefined || createdBy === null) return res.status(400).json({ error: 'createdBy requis' });
            const createdByNorm = String(createdBy).trim();
            if (createdByNorm === '') return res.status(400).json({ error: 'createdBy invalide' });

            // validate ingredients / etapes
            if (!Array.isArray(ingredients) || ingredients.length === 0 || !ingredients.every(i => typeof i === 'string')) {
                return res.status(400).json({ error: 'ingredients doit être un tableau non vide de chaînes' });
            }
            if (!Array.isArray(etapes) || etapes.length === 0 || !etapes.every(e => typeof e === 'string')) {
                return res.status(400).json({ error: 'etapes doit être un tableau non vide de chaînes' });
            }

            const createdAtDate = createdAt ? new Date(createdAt) : new Date();
            if (isNaN(createdAtDate.getTime())) return res.status(400).json({ error: 'createdAt invalide' });

            // vérifications optionnelles côté Postgres si productId est entier
            try {
                if (Number.isInteger(productIdNorm)) {
                    const prodOk = await productExists(productIdNorm);
                    if (!prodOk) return res.status(400).json({ error: 'Produit introuvable' });
                }
            } catch (err) {
                console.error('Erreur produits:', err);
                return res.status(500).json({ error: 'Erreur base de données (produits)', detail: err.message });
            }

            const doc = {
                productId: productIdNorm,
                ingredients,
                etapes,
                createdBy: createdByNorm,
                createdAt: createdAtDate
            };

            try {
                const result = await db.collection('recette').insertOne(doc);
                return res.status(201).json({ insertedId: result.insertedId });
            } catch (err) {
                // détailler l'erreur de validation MongoDB si présente
                if (err && (err.code === 121 || (err.name === 'MongoServerError' && /Document failed validation/.test(err.message)))) {
                    const detail = err.errInfo || { message: err.message };
                    console.error('Validation MongoDB:', detail);
                    return res.status(400).json({ error: 'Document invalide (validation MongoDB)', detail });
                }
                console.error('Insert MongoDB inattendu:', err);
                return res.status(500).json({ error: 'Erreur serveur', detail: err.message });
            }
        } catch (err) {
            console.error('POST /recettes - erreur inattendue:', err);
            return res.status(500).json({ error: 'Erreur serveur', detail: err.message });
        }
    });

    app.put('/recettes/:id', async (req, res) => {
        try {
            const id = req.params.id;
            const { productId, ingredients, etapes, createdBy, createdAt } = req.body;

            if (!req.body || Object.keys(req.body).length === 0) {
                return res.status(400).json({ error: 'Body vide' });
            }

            const update = {};

            // productId (optionnel) : int si possible sinon string non vide
            if (req.body.hasOwnProperty('productId')) {
                const pid = parseInt(productId, 10);
                const productIdNorm = !Number.isNaN(pid) ? pid : (typeof productId === 'string' && productId.trim() !== '' ? productId : null);
                if (productIdNorm === null) return res.status(400).json({ error: 'productId invalide' });

                if (Number.isInteger(productIdNorm)) {
                    try {
                        const ok = await productExists(productIdNorm);
                        if (!ok) return res.status(400).json({ error: 'Produit introuvable' });
                    } catch (err) {
                        console.error('Erreur produits:', err);
                        return res.status(500).json({ error: 'Erreur base de données (produits)', detail: err.message });
                    }
                }
                update.productId = productIdNorm;
            }

            // ingredients (optionnel)
            if (req.body.hasOwnProperty('ingredients')) {
                if (!Array.isArray(ingredients) || ingredients.length === 0 || !ingredients.every(i => typeof i === 'string')) {
                    return res.status(400).json({ error: 'ingredients doit être un tableau non vide de chaînes' });
                }
                update.ingredients = ingredients;
            }

            // etapes (optionnel)
            if (req.body.hasOwnProperty('etapes')) {
                if (!Array.isArray(etapes) || etapes.length === 0 || !etapes.every(e => typeof e === 'string')) {
                    return res.status(400).json({ error: 'etapes doit être un tableau non vide de chaînes' });
                }
                update.etapes = etapes;
            }

            // createdBy (optionnel) : normalisé en string, si numérique on peut vérifier en PG
            if (req.body.hasOwnProperty('createdBy')) {
                if (createdBy === undefined || createdBy === null) return res.status(400).json({ error: 'createdBy invalide' });
                const createdByNorm = String(createdBy).trim();
                if (createdByNorm === '') return res.status(400).json({ error: 'createdBy invalide' });

                const asInt = parseInt(createdBy, 10);
                if (!Number.isNaN(asInt)) {
                    try {
                        const ok = await clientExists(asInt);
                        if (!ok) return res.status(400).json({ error: 'Client (createdBy) introuvable' });
                    } catch (err) {
                        console.error('Erreur clients:', err);
                        return res.status(500).json({ error: 'Erreur base de données (clients)', detail: err.message });
                    }
                }
                update.createdBy = createdByNorm;
            }

            // createdAt (optionnel)
            if (req.body.hasOwnProperty('createdAt')) {
                const d = new Date(createdAt);
                if (isNaN(d.getTime())) return res.status(400).json({ error: 'createdAt invalide' });
                update.createdAt = d;
            }

            if (Object.keys(update).length === 0) return res.status(400).json({ error: 'Aucun champ modifiable fourni' });

            const collection = db.collection('recette');

            // Cible : ObjectId
            if (ObjectId.isValid(id)) {
                const filter = { _id: new ObjectId(id) };
                const result = await collection.findOneAndUpdate(filter, { $set: update }, { returnDocument: 'after' });
                if (!result.value) return res.status(404).json({ error: 'Recette non trouvée' });
                return res.json(result.value);
            }

            // Fallback : productId (entier)
            const asInt = parseInt(id, 10);
            if (!Number.isNaN(asInt)) {
                const docs = await collection.find({ productId: asInt }).toArray();
                if (docs.length === 0) return res.status(404).json({ error: 'Recette non trouvée pour ce productId' });
                if (docs.length > 1) return res.status(400).json({ error: 'Plusieurs recettes pour ce productId, préciser _id' });

                const filter = { _id: docs[0]._id };
                const result = await collection.findOneAndUpdate(filter, { $set: update }, { returnDocument: 'after' });
                return res.json(result.value);
            }

            return res.status(400).json({ error: 'Id invalide (ni ObjectId ni entier productId)' });
        } catch (err) {
            // gestion erreur validation MongoDB
            if (err && (err.code === 121 || (err.name === 'MongoServerError' && /Document failed validation/.test(err.message)))) {
                const detail = err.errInfo || { message: err.message };
                console.error('Validation MongoDB:', detail);
                return res.status(400).json({ error: 'Document invalide (validation MongoDB)', detail });
            }
            console.error('PUT /recettes/:id - erreur inattendue:', err);
            return res.status(500).json({ error: 'Erreur serveur', detail: err.message });
        }
    });

    app.delete('/recettes/:id', async (req, res) => {
        try {
            const id = req.params.id;
            const collection = db.collection('recette');

            // 1) suppression par ObjectId Mongo valide
            if (ObjectId.isValid(id)) {
                const result = await collection.deleteOne({ _id: new ObjectId(id) });
                if (result.deletedCount === 0) return res.status(404).json({ error: 'Recette non trouvée' });
                return res.json({ deleted: true, id });
            }

            // 2) fallback : productId (entier)
            const asInt = parseInt(id, 10);
            if (!Number.isNaN(asInt)) {
                const docs = await collection.find({ productId: asInt }).toArray();
                if (docs.length === 0) return res.status(404).json({ error: 'Recette non trouvée pour ce productId' });
                if (docs.length > 1) return res.status(400).json({ error: 'Plusieurs recettes pour ce productId, préciser _id' });

                const result = await collection.deleteOne({ _id: docs[0]._id });
                if (result.deletedCount === 0) return res.status(500).json({ error: 'Échec suppression' });
                return res.json({ deleted: true, productId: asInt });
            }

            return res.status(400).json({ error: 'Id invalide (ni ObjectId ni entier productId)' });
        } catch (err) {
            console.error('DELETE /recettes/:id - erreur inattendue:', err);
            return res.status(500).json({ error: 'Erreur serveur', detail: err.message });
        }
    });



    app.post('/avis', async (req, res) => {
        try {
            const { productId, clientId, note, commentaire, dateDePublication } = req.body;

            // parse pour vérifs PG
            const pid = parseInt(productId, 10);
            const cid = parseInt(clientId, 10);
            if (Number.isNaN(pid) || Number.isNaN(cid)) {
                return res.status(400).json({ error: 'productId et clientId doivent être des entiers' });
            }

            // note doit être un entier 1-5 (Mongo attend int)
            let n;
            if (note !== undefined) {
                n = parseInt(note, 10);
                if (Number.isNaN(n) || n < 1 || n > 5) {
                    return res.status(400).json({ error: 'note doit être un entier entre 1 et 5' });
                }
            }

            if (commentaire !== undefined && typeof commentaire !== 'string') {
                return res.status(400).json({ error: 'commentaire doit être une chaîne' });
            }

            // vérifications PostgreSQL (utilise pid/cid entiers)
            try {
                if (!(await productExists(pid))) return res.status(400).json({ error: 'Produit introuvable' });
                if (!(await clientExists(cid))) return res.status(400).json({ error: 'Client introuvable' });
            } catch (err) {
                console.error('Erreur vérif PG:', err);
                return res.status(500).json({ error: 'Erreur base de données (PG)', detail: err.message });
            }

            // construire le document conforme au schéma Mongo (clientId en string, note en int)
            const doc = {
                productId: pid,
                clientId: String(cid),
                ...(n !== undefined ? { note: n } : {}),
                commentaire: commentaire ? String(commentaire).trim() : '',
                dateDePublication: dateDePublication ? new Date(dateDePublication) : new Date()
            };

            try {
                const result = await db.collection('avis').insertOne(doc);
                return res.status(201).json({ insertedId: result.insertedId });
            } catch (err) {
                if (err && (err.code === 121 || (err.name === 'MongoServerError' && /Document failed validation/.test(err.message)))) {
                    const detail = err.errInfo || { message: err.message };
                    console.error('Validation MongoDB:', detail);
                    return res.status(400).json({ error: 'Document invalide (validation MongoDB)', detail });
                }
                console.error('POST /avis - erreur insert:', err);
                return res.status(500).json({ error: 'Erreur serveur', detail: err.message });
            }
        } catch (err) {
            console.error('POST /avis - erreur inattendue:', err);
            return res.status(500).json({ error: 'Erreur serveur', detail: err.message });
        }
    });


    app.get('/avis', async (req, res) => {
        try {
            const q = {};
            if (req.query.productId) {
                const pid = parseInt(req.query.productId, 10);
                if (Number.isNaN(pid)) return res.status(400).json({ error: 'productId invalide' });
                q.productId = pid;
            }
            const docs = await db.collection('avis').find(q).sort({ dateDePublication: -1 }).limit(100).toArray();
            return res.json(docs);
        } catch (err) {
            console.error('GET /avis - erreur:', err);
            return res.status(500).json({ error: 'Erreur serveur', detail: err.message });
        }
    });

    app.get('/avis/:id', async (req, res) => {
        try {
            const id = req.params.id;
            const coll = db.collection('avis');

            if (ObjectId.isValid(id)) {
                const doc = await coll.findOne({ _id: new ObjectId(id) });
                if (doc) return res.json(doc);
                // si ObjectId valide mais pas trouvé, on continue fallback
            }

            const asInt = parseInt(id, 10);
            if (!Number.isNaN(asInt)) {
                const docs = await coll.find({ productId: asInt }).toArray();
                if (docs.length === 0) return res.status(404).json({ error: 'Aucun avis pour ce productId' });
                if (docs.length === 1) return res.json(docs[0]);
                return res.json(docs); // plusieurs avis pour le même produit
            }

            return res.status(400).json({ error: 'Id invalide (ni ObjectId ni entier productId)' });
        } catch (err) {
            console.error('GET /avis/:id - erreur:', err);
            return res.status(500).json({ error: 'Erreur serveur', detail: err.message });
        }
    });

    app.put('/avis/:id', async (req, res) => {
        try {
            const id = req.params.id;
            if (!req.body || Object.keys(req.body).length === 0) return res.status(400).json({ error: 'Body vide' });

            const update = {};

            if (req.body.hasOwnProperty('productId')) {
                const pid = parseInt(req.body.productId, 10);
                if (Number.isNaN(pid)) return res.status(400).json({ error: 'productId invalide' });
                if (!(await productExists(pid))) return res.status(400).json({ error: 'Produit introuvable' });
                update.productId = pid;
            }

            if (req.body.hasOwnProperty('clientId')) {
                const cid = parseInt(req.body.clientId, 10);
                if (Number.isNaN(cid)) return res.status(400).json({ error: 'clientId invalide' });
                if (!(await clientExists(cid))) return res.status(400).json({ error: 'Client introuvable' });
                // Stocker en string pour correspondre au schéma Mongo
                update.clientId = String(cid);
            }

            if (req.body.hasOwnProperty('note')) {
                const n = parseInt(req.body.note, 10);
                if (Number.isNaN(n) || n < 1 || n > 5) return res.status(400).json({ error: 'note invalide (1-5)' });
                // Stocker comme int
                update.note = n;
            }

            if (req.body.hasOwnProperty('commentaire')) {
                if (req.body.commentaire !== null && typeof req.body.commentaire !== 'string') {
                    return res.status(400).json({ error: 'commentaire doit être une chaîne' });
                }
                update.commentaire = req.body.commentaire ? String(req.body.commentaire).trim() : '';
            }

            if (req.body.hasOwnProperty('dateDePublication')) {
                const d = new Date(req.body.dateDePublication);
                if (isNaN(d.getTime())) return res.status(400).json({ error: 'dateDePublication invalide' });
                update.dateDePublication = d;
            }

            if (Object.keys(update).length === 0) return res.status(400).json({ error: 'Aucun champ modifiable fourni' });

            const coll = db.collection('avis');

            if (ObjectId.isValid(id)) {
                const filter = { _id: new ObjectId(id) };
                const result = await coll.findOneAndUpdate(filter, { $set: update }, { returnDocument: 'after' });
                if (!result.value) return res.status(404).json({ error: 'Avis non trouvé' });
                return res.json(result.value);
            }

            const asInt = parseInt(id, 10);
            if (!Number.isNaN(asInt)) {
                const docs = await coll.find({ productId: asInt }).toArray();
                if (docs.length === 0) return res.status(404).json({ error: 'Aucun avis pour ce productId' });
                if (docs.length > 1) return res.status(400).json({ error: 'Plusieurs avis pour ce productId, préciser _id' });
                const filter = { _id: docs[0]._id };
                const result = await coll.findOneAndUpdate(filter, { $set: update }, { returnDocument: 'after' });
                return res.json(result.value);
            }

            return res.status(400).json({ error: 'Id invalide (ni ObjectId ni entier productId)' });
        } catch (err) {
            if (err && (err.code === 121 || (err.name === 'MongoServerError' && /Document failed validation/.test(err.message)))) {
                const detail = err.errInfo || { message: err.message };
                console.error('Validation MongoDB:', detail);
                return res.status(400).json({ error: 'Document invalide (validation MongoDB)', detail });
            }
            console.error('PUT /avis/:id - erreur inattendue:', err);
            return res.status(500).json({ error: 'Erreur serveur', detail: err.message });
        }
    });


    app.delete('/avis/:id', async (req, res) => {
        try {
            const id = req.params.id;
            const coll = db.collection('avis');

            // 1) suppression par ObjectId Mongo valide
            if (ObjectId.isValid(id)) {
                const result = await coll.deleteOne({ _id: new ObjectId(id) });
                if (result.deletedCount === 0) return res.status(404).json({ error: 'Avis non trouvé' });
                return res.json({ deleted: true, id });
            }

            // 2) fallback : productId entier
            const asInt = parseInt(id, 10);
            if (!Number.isNaN(asInt)) {
                const docs = await coll.find({ productId: asInt }).toArray();
                if (docs.length === 0) return res.status(404).json({ error: 'Aucun avis pour ce productId' });
                if (docs.length > 1) return res.status(400).json({ error: 'Plusieurs avis pour ce productId, préciser _id' });

                const result = await coll.deleteOne({ _id: docs[0]._id });
                if (result.deletedCount === 0) return res.status(500).json({ error: 'Échec suppression' });
                return res.json({ deleted: true, productId: asInt });
            }

            // 3) fallback : productId en string (ex: SKU)
            if (typeof id === 'string' && id.trim() !== '') {
                const q = { productId: id };
                const docs = await coll.find(q).toArray();
                if (docs.length === 0) return res.status(404).json({ error: 'Aucun avis pour ce productId (string)' });
                if (docs.length > 1) return res.status(400).json({ error: 'Plusieurs avis pour ce productId (string), préciser _id' });

                const result = await coll.deleteOne({ _id: docs[0]._id });
                if (result.deletedCount === 0) return res.status(500).json({ error: 'Échec suppression' });
                return res.json({ deleted: true, productId: id });
            }

            return res.status(400).json({ error: 'Id invalide (ni ObjectId ni productId valide)' });
        } catch (err) {
            console.error('DELETE /avis/:id - erreur inattendue:', err);
            return res.status(500).json({ error: 'Erreur serveur', detail: err.message });
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

    app.get('/top-produits', async (req, res) => {
        try {
            const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 20));

            const sql = `
                SELECT p.id_produit,
                       p.nom,
                       SUM(pc.quantite_produit)                        AS total_qty,
                       SUM(pc.quantite_produit * COALESCE(p.prix, 0))  AS total_revenue
                FROM produit_commande pc
                         JOIN produits p ON p.id_produit = pc.id_produit
                GROUP BY p.id_produit, p.nom
                ORDER BY total_revenue DESC
                    LIMIT $1
            `;

            const { rows } = await pool.query(sql, [limit]);
            return res.json(rows);
        } catch (err) {
            console.error('GET /top-produits - erreur', err);
            return res.status(500).json({ error: 'Erreur serveur', detail: err.message });
        }
    });

    app.get('/top-clients', async (req, res) => {
        try {
            const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 10));

            const sql = `
                SELECT c.id_client,
                       c.nom,
                       c.email,
                       SUM(pc.quantite_produit * COALESCE(p.prix, 0)) AS total_spent,
                       COUNT(DISTINCT co.id_commande) AS commandes_count
                FROM clients c
                         JOIN commandes co ON co.id_client = c.id_client
                         JOIN produit_commande pc ON pc.id_commande = co.id_commande
                         JOIN produits p ON p.id_produit = pc.id_produit
                GROUP BY c.id_client, c.nom, c.email
                ORDER BY total_spent DESC
                    LIMIT $1
            `;

            const { rows } = await pool.query(sql, [limit]);
            return res.json(rows);
        } catch (err) {
            console.error('GET /top-clients - erreur', err);
            return res.status(500).json({ error: 'Erreur serveur', detail: err.message });
        }
    });

    app.get('/revenu-mensuel', async (req, res) => {
        try {
            // nombre de mois à remonter (par défaut 11 => 12 mois incluant le mois courant)
            const months = Math.max(1, Math.min(60, parseInt(req.query.months, 10) || 11));

            // calculer la date du premier jour du mois N mois avant le mois courant
            const start = new Date();
            start.setDate(1);
            start.setMonth(start.getMonth() - months);
            const startIso = start.toISOString().slice(0, 10); // YYYY-MM-DD

            const sql = `
      SELECT date_trunc('month', co.date_commande) AS month,
             SUM(pc.quantite_produit * COALESCE(p.prix, 0)) AS revenue,
             COUNT(DISTINCT co.id_commande) AS orders_count
      FROM commandes co
      JOIN produit_commande pc ON pc.id_commande = co.id_commande
      JOIN produits p ON p.id_produit = pc.id_produit
      WHERE co.date_commande >= $1::date
      GROUP BY month
      ORDER BY month DESC
    `;

            const { rows } = await pool.query(sql, [startIso]); // remplacer pgPool si nécessaire
            return res.json(rows);
        } catch (err) {
            console.error('GET /revenu-mensuel - erreur', err);
            return res.status(500).json({ error: 'Erreur serveur', detail: err.message });
        }
    });

    app.get('/stats-commandes', async (req, res) => {
        try {
            const sql = `
      WITH order_totals AS (
        SELECT co.id_commande,
               SUM(pc.quantite_produit * COALESCE(p.prix, 0)) AS total
        FROM commandes co
        JOIN produit_commande pc ON pc.id_commande = co.id_commande
        JOIN produits p ON p.id_produit = pc.id_produit
        GROUP BY co.id_commande
      )
      SELECT AVG(total) AS avg_order,
             PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total) AS median_order,
             COUNT(*) AS nb_orders
      FROM order_totals;
    `;

            const { rows } = await pool.query(sql);
            return res.json(rows[0] || { avg_order: 0, median_order: 0, nb_orders: 0 });
        } catch (err) {
            console.error('GET /stats-commandes - erreur', err);
            return res.status(500).json({ error: 'Erreur serveur', detail: err.message });
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