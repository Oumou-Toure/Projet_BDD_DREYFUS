// Récupere tout les commandes sans les produits
'http://localhost:3000/commandes' // GET


// Récupere tout les commandes avec les produits
'http://localhost:3000/commandes-produits' // GET


// Récupere un commande par son ID
'http://localhost:3000/commandes/1' // GET


// Créer une nouvelle commande
'http://localhost:3000/commandes' // POST

Content-Type: application/json
{
    "id_client": 1,
    "items": [
    { "id_produit": 1, "quantite_produit": 2 },
    { "id_produit": 3, "quantite_produit": 1 }
]
}


// Modifier une commande existant
'http://localhost:3000/commandes/1' // PUT

Content-Type: application/json
{
    "prix": 13.00,
    "quantite_stock": 18
}


// Supprimer une commande
'http://localhost:3000/commandes/1' // DELETE


