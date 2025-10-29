CREATE TABLE clients{

    id_client SERIAL PRIMARY KEY,
    nom VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    adresse TEXT,
    telephone VARCHAR(20)

}

CREATE TABLE produits{

    id_produit SERIAL PRIMARY KEY,
    nom VARCHAR(100) NOT NULL,
    categorie VARCHAR(100),
    description TEXT,
    prix NUMERIC(10,2) NOT NULL,
    quantite_stock INT NOT NULL CHECK (quantite_stock >= 0)

}

CREATE TABLE commandes{

    id_commande SERIAL PRIMARY KEY,
    date_commande DATE NOT NULL DEFAULT CURRENT_DATE,
    total NUMERIC(10,2) DEFAULT 0,
    id_client INT NOT NULL,
    FOREIGN KEY (id_client) REFERENCES clients(id_client) ON DELETE CASCADE

}

CREATE TABLE produit_commande{

    id_produit_commande SERIAL PRIMARY KEY,
    id_commande INT NOT NULL,
    id_produit INT NOT NULL,
    quantite_produit INT NOT NULL CHECK (quantite_produit > 0),
    FOREIGN KEY (id_commande) REFERENCES commandes(id_commande) ON DELETE CASCADE,
    FOREIGN KEY (id_produit) REFERENCES produits(id_produit) ON DELETE CASCADE
    
}