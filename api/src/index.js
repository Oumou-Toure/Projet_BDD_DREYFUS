// api/src/index.js
require('dotenv').config();
const express = require('express');
const { initPostgres, initMongo } = require('./db');
const { MongoClient } = require('mongodb');

const app = express();
app.use(express.json());
const port = process.env.PORT || 3000;

const MONGO_URI = 'mongodb://admin:password@mongo:27017/?authSource=admin';
const DB_NAME = 'sweetcake';

async function start() {
    const client = new MongoClient(MONGO_URI, {useUnifiedTopology: true});
    await client.connect();
    const db = client.db(DB_NAME);

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

    app.listen(port, () => {
        console.log('API started on port', port);
    });
}

start().catch(err => {
    console.error('Impossible de démarrer le serveur', err);
    process.exit(1);
});