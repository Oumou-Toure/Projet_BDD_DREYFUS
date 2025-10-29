const { MongoClient, ObjectId } = require('mongodb');
const uri = 'mongodb://localhost:27017';
const dbName = 'patisserie';

async function run() {
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db(dbName);
    const clientsCol = db.collection('clients');
    const produitsCol = db.collection('produits');
    const commandesCol = db.collection('commandes');

    // insert "en dur"
    const clients = [
        { nom: 'Alice Martin', email: 'alice@example.com', adresse: '12 rue du Four, Paris', telephone: '0123456789' },
        { nom: 'Bruno Dupont', email: 'bruno@example.com', adresse: '23 avenue des Fleurs, Lyon', telephone: '0987654321' }
    ];
    const produits = [
        { nom: 'Croissant', categorie: 'Viennoiserie', description: 'Au beurre', prix: 1.2, quantite_stock: 100 },
        { nom: 'Tarte aux pommes', categorie: 'Patisserie', description: 'Maison', prix: 12.5, quantite_stock: 20 }
    ];

    const { insertedIds: clientIds } = await clientsCol.insertMany(clients);
    const { insertedIds: produitIds } = await produitsCol.insertMany(produits);

    // creer une commande (ex: reference aux produits)
    const commande = {
        id_client: clientIds['0'],
        date_commande: new Date(),
        items: [
            { id_produit: produitIds['0'], quantite: 3, prix_unitaire: produits[0].prix },
            { id_produit: produitIds['1'], quantite: 1, prix_unitaire: produits[1].prix }
        ],
        total: 3 * produits[0].prix + 1 * produits[1].prix
    };
    const { insertedId } = await commandesCol.insertOne(commande);

    // decrementer le stock (séquentiel; pour vrai usage, utiliser transactions sur un replicaset)
    for (const it of commande.items) {
        await produitsCol.updateOne({ _id: it.id_produit }, { $inc: { quantite_stock: -it.quantite } });
    }

    // CRUD exemples
    // READ all clients
    const allClients = await clientsCol.find().toArray();

    // READ client by _id
    const client = await clientsCol.findOne({ _id: ObjectId(clientIds['0']) });

    // UPDATE client
    await clientsCol.updateOne({ _id: ObjectId(clientIds['0']) }, { $set: { telephone: '0611223344' } });

    // DELETE client
    // (attention : si on veut supprimer, s'assurer des commandes liées)
    // await clientsCol.deleteOne({ _id: ObjectId(clientIds['1']) });

    // Read commandes with embedded product details (join simulé via aggregation)
    const ordersWithProducts = await commandesCol.aggregate([
        { $unwind: '$items' },
        {
            $lookup: {
                from: 'produits',
                localField: 'items.id_produit',
                foreignField: '_id',
                as: 'prod'
            }
        },
        { $unwind: { path: '$prod', preserveNullAndEmptyArrays: true } },
        {
            $group: {
                _id: '$_id',
                id_client: { $first: '$id_client' },
                date_commande: { $first: '$date_commande' },
                total: { $first: '$total' },
                items: { $push: { id_produit: '$items.id_produit', nom: '$prod.nom', quantite: '$items.quantite', prix_unitaire: '$items.prix_unitaire' } }
            }
        }
    ]).toArray();

    await client.close();
}

run().catch(console.error);
