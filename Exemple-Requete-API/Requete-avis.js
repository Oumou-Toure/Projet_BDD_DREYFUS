// Récupere tout les avis
'http://localhost:3000/avis' // GET


// Récupere une avis par son ID
'http://localhost:3000/avis/:avisId' // GET


// Créer une nouveau avis
'http://localhost:3000/avis' // POST

Content-Type: application/json
{
    "productId": 123,
    "clientId": 42,
    "note": 4.5,
    "commentaire": "Très bon produit",
    "dateDePublication": "2025-11-02T12:00:00Z"
}



// Modifier une avis existant
'http://localhost:3000/avis/:avisId' // PUT

Content-Type: application/json
{
    "commentaire": "Mise à jour via productId",
    "note": 4
}


// Supprimer une avis
'http://localhost:3000/avis/:avisId' // DELETE


