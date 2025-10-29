
BEGIN;

DROP TABLE IF EXISTS produit_commande;
DROP TABLE IF EXISTS commandes;
DROP TABLE IF EXISTS produits;
DROP TABLE IF EXISTS clients;

CREATE TABLE clients (
                         id_client SERIAL PRIMARY KEY,
                         nom VARCHAR(100) NOT NULL,
                         email VARCHAR(150) UNIQUE NOT NULL,
                         adresse TEXT,
                         telephone VARCHAR(20)
);

CREATE TABLE produits (
                          id_produit SERIAL PRIMARY KEY,
                          nom VARCHAR(100) NOT NULL,
                          categorie VARCHAR(100),
                          description TEXT,
                          prix NUMERIC(10,2) NOT NULL,
                          quantite_stock INT NOT NULL CHECK (quantite_stock >= 0)
);

CREATE TABLE commandes (
                           id_commande SERIAL PRIMARY KEY,
                           date_commande DATE NOT NULL DEFAULT CURRENT_DATE,
                           total NUMERIC(10,2) DEFAULT 0,
                           id_client INT NOT NULL,
                           CONSTRAINT fk_commandes_client FOREIGN KEY (id_client) REFERENCES clients(id_client) ON DELETE CASCADE
);

CREATE TABLE produit_commande (
                                  id_produit_commande SERIAL PRIMARY KEY,
                                  id_commande INT NOT NULL,
                                  id_produit INT NOT NULL,
                                  quantite_produit INT NOT NULL CHECK (quantite_produit > 0),
                                  CONSTRAINT fk_prodcmd_commande FOREIGN KEY (id_commande) REFERENCES commandes(id_commande) ON DELETE CASCADE,
                                  CONSTRAINT fk_prodcmd_produit FOREIGN KEY (id_produit) REFERENCES produits(id_produit) ON DELETE CASCADE
);

INSERT INTO clients (nom, email, adresse, telephone) VALUES
                                                         ('Alice Martin', 'alice@example.com', '12 rue du Four, Paris', '0123456789'),
                                                         ('Bruno Dupont', 'bruno@example.com', '23 avenue des Fleurs, Lyon', '0987654321'),
                                                         ('Carole Bernard', 'carole@example.com', '5 place de la République, Nice', '0612345678');

INSERT INTO produits (nom, categorie, description, prix, quantite_stock) VALUES
                                                                             ('Tarte aux pommes', 'Patisserie', 'Tarte aux pommes maison', 12.50, 20),
                                                                             ('Éclair au chocolat', 'Patisserie', 'Éclair garni chocolat', 3.80, 50),
                                                                             ('Croissant', 'Viennoiserie', 'Croissant au beurre', 1.20, 100),
                                                                             ('Gâteau de mariage', 'Gâteaux', 'Gâteau 3 étages, vanille', 250.00, 2);

INSERT INTO commandes (date_commande, total, id_client) VALUES
                                                            (CURRENT_DATE - INTERVAL '3 days', 0, (SELECT id_client FROM clients WHERE email = 'alice@example.com' LIMIT 1)),
                                                            (CURRENT_DATE - INTERVAL '1 day', 0, (SELECT id_client FROM clients WHERE email = 'bruno@example.com' LIMIT 1)),
                                                            (CURRENT_DATE, 0, (SELECT id_client FROM clients WHERE email = 'carole@example.com' LIMIT 1));


INSERT INTO produit_commande (id_commande, id_produit, quantite_produit)
VALUES
    (
        (SELECT id_commande FROM commandes WHERE id_client = (SELECT id_client FROM clients WHERE email = 'alice@example.com') LIMIT 1),
        (SELECT id_produit FROM produits WHERE nom = 'Tarte aux pommes' LIMIT 1),
        2
    ),
    (
        (SELECT id_commande FROM commandes WHERE id_client = (SELECT id_client FROM clients WHERE email = 'alice@example.com') LIMIT 1),
        (SELECT id_produit FROM produits WHERE nom = 'Croissant' LIMIT 1),
        3
    );

INSERT INTO produit_commande (id_commande, id_produit, quantite_produit)
VALUES
    (
        (SELECT id_commande FROM commandes WHERE id_client = (SELECT id_client FROM clients WHERE email = 'bruno@example.com') LIMIT 1),
        (SELECT id_produit FROM produits WHERE nom = 'Éclair au chocolat' LIMIT 1),
        5
    ),
    (
        (SELECT id_commande FROM commandes WHERE id_client = (SELECT id_client FROM clients WHERE email = 'bruno@example.com') LIMIT 1),
        (SELECT id_produit FROM produits WHERE nom = 'Gâteau de mariage' LIMIT 1),
        1
    );

INSERT INTO produit_commande (id_commande, id_produit, quantite_produit)
VALUES
    (
        (SELECT id_commande FROM commandes WHERE id_client = (SELECT id_client FROM clients WHERE email = 'carole@example.com') LIMIT 1),
        (SELECT id_produit FROM produits WHERE nom = 'Croissant' LIMIT 1),
        10
    );

-- Recalculer les totaux des commandes
UPDATE commandes
SET total = (
    SELECT COALESCE(SUM(p.prix * pc.quantite_produit), 0)
    FROM produit_commande pc
             JOIN produits p ON p.id_produit = pc.id_produit
    WHERE pc.id_commande = commandes.id_commande
);

-- Mettre à jour le stock des produits
UPDATE produits p
SET quantite_stock = p.quantite_stock - COALESCE((
                                                     SELECT SUM(pc.quantite_produit) FROM produit_commande pc WHERE pc.id_produit = p.id_produit
                                                 ), 0)
WHERE EXISTS (SELECT 1 FROM produit_commande pc WHERE pc.id_produit = p.id_produit);

COMMIT;
