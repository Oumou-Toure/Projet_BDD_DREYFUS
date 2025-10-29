// javascript
// init-mongo/collections.js
db = db.getSiblingDB('sweetcake');

function hasCollection(name) {
    return db.getCollectionNames().includes(name);
}

/* Collection `recette`:
   - productId : identifiant du produit dans Postgres (string ou int)
   - ingredients : array de string
   - etapes : array de string
   - createdBy, createdAt
*/
if (!hasCollection('recette')) {
    db.createCollection('recette', {
        validator: {
            $jsonSchema: {
                bsonType: 'object',
                required: ['productId', 'ingredients', 'etapes', 'createdBy'],
                properties: {
                    productId: {
                        bsonType: ['string', 'int', 'long'],
                        description: "Identifiant du produit dans Postgres (string ou entier)"
                    },
                    ingredients: {
                        bsonType: 'array',
                        minItems: 1,
                        items: { bsonType: 'string' },
                        description: "Liste d'ingrédients"
                    },
                    etapes: {
                        bsonType: 'array',
                        minItems: 1,
                        items: { bsonType: 'string' },
                        description: "Liste d'étapes"
                    },
                    createdBy: { bsonType: 'string', description: 'Auteur de la recette' },
                    createdAt: { bsonType: 'date', description: 'Date de création' }
                }
            }
        },
        validationLevel: 'moderate'
    });

    db.recette.createIndex({ productId: 1 }, { background: true });

    db.recette.insertOne({
        productId: "42", // exemple : id Postgres stocké en string (ou remplacer par 42)
        ingredients: ['farine', 'sucre', 'oeufs'],
        etapes: ['mélanger', 'cuire 30min'],
        createdBy: 'admin',
        createdAt: new Date()
    });
}

/* Collection `avis`:
   - productId : référence au produit Postgres
   - clientId, commentaire, dateDePublication, note optional
*/
if (!hasCollection('avis')) {
    db.createCollection('avis', {
        validator: {
            $jsonSchema: {
                bsonType: 'object',
                required: ['productId', 'clientId', 'commentaire', 'dateDePublication'],
                properties: {
                    productId: {
                        bsonType: ['string', 'int', 'long'],
                        description: "Identifiant du produit dans Postgres (string ou entier)"
                    },
                    clientId: { bsonType: 'string', description: "Identifiant du client" },
                    commentaire: { bsonType: 'string', description: "Texte de l'avis" },
                    dateDePublication: { bsonType: 'date', description: 'Date de publication' },
                    note: { bsonType: 'int', minimum: 1, maximum: 5, description: 'Note optionnelle 1-5' }
                }
            }
        },
        validationLevel: 'moderate'
    });

    db.avis.createIndex({ productId: 1 }, { background: true });
    db.avis.createIndex({ clientId: 1 }, { background: true });

    db.avis.insertOne({
        productId: "42",
        clientId: 'client_123',
        commentaire: 'Très bonne recette, facile à suivre.',
        dateDePublication: new Date(),
        note: 5
    });
}
