// Récupere tout les produits
'http://localhost:3000/produits' // GET


// Récupere un produit par son ID
'http://localhost:3000/produits/1' // GET


// Créer un nouveau produit
'http://localhost:3000/produits' // POST

Content-Type: application/json
{
    "nom": "Gâteau au chocolat",
    "categorie": "Pâtisserie",
    "description": "Petit gâteau fondant",
    "prix": 12.50,
    "quantite_stock": 20
}


// Modifier un produit existant
'http://localhost:3000/produits/1' // PUT

Content-Type: application/json
{
    "prix": 13.00,
    "quantite_stock": 18
}


// Supprimer un produit
'http://localhost:3000/produits/1' // DELETE


