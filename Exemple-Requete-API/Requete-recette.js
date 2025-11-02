// Récupere tout les recettes
'http://localhost:3000/recettes' // GET


// Récupere une recette par son ID
'http://localhost:3000/recettes/:recetteId' // GET


// Créer une nouveau recette
'http://localhost:3000/recettes' // POST

Content-Type: application/json
{
"productId": 1,
    "ingredients": ["farine", "sucre", "oeufs"],
    "etapes": ["Préchauffer le four", "Mélanger les ingrédients", "Cuire 30 min"],
    "createdBy": "1",
    "createdAt": "2025-11-02T11:00:00Z"
}



// Modifier une recette existant
'http://localhost:3000/recettes/:recetteId' // PUT

Content-Type: application/json
{
"ingredients": ["farine", "sucre", "oeufs", "beurre"],
    "etapes": ["Préchauffer à 180°C", "Mélanger", "Cuire 25 min"],
    "createdBy": "oui-oui12"
}


// Supprimer une recette
'http://localhost:3000/recettes/:recetteId' // DELETE


