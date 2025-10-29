-- PRODUITS
-- Create
INSERT INTO produits (nom, categorie, description, prix, quantite_stock)
VALUES ($1, $2, $3, $4, $5) RETURNING id_produit;

-- Read all
SELECT * FROM produits ORDER BY id_produit;

-- Read by id
SELECT * FROM produits WHERE id_produit = $1;

-- Update
UPDATE produits
SET nom = COALESCE($2, nom),
    categorie = COALESCE($3, categorie),
    description = COALESCE($4, description),
    prix = COALESCE($5, prix),
    quantite_stock = COALESCE($6, quantite_stock)
WHERE id_produit = $1
    RETURNING *;

-- Delete
DELETE FROM produits WHERE id_produit = $1;