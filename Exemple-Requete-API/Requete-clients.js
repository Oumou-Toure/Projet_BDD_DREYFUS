// Récupere tout les clients
'http://localhost:3000/clients' // GET


// Récupere un client par son ID
'http://localhost:3000/clients/:clientId' // GET


// Créer un nouveau client
'http://localhost:3000/clients' // POST

Content-Type: application/json
{
    "nom": "John Doe",
    "email": "John.doe@exemple.com"
    "adresse": "10 rue de la Paix, Paris",
    "telephone": "+33123456789"
}


// Modifier un client existant
'http://localhost:3000/clients/:clientId' // PUT

Content-Type: application/json
{
    "nom": "Dupont",
    "email": "dupont.nouveau@example.com",
    "adresse": "12 avenue Victor Hugo, Paris",
    "telephone": "+33123456790"
}


// Supprimer un client
'http://localhost:3000/clients/:clientId' // DELETE


