-- COMMANDES (transactionnelle) : créer une commande avec ses lignes, mettre à jour total et stock
-- Exemple paramétré : $1 = id_client ; produits passés via VALUES list (id_produit, quantite)
BEGIN;

WITH new_cmd AS (
INSERT INTO commandes (id_client) VALUES ($1) RETURNING id_commande
    ),
    lines AS (
-- remplacer le VALUES ci‑dessous par la liste des lignes reçues (ex: (2,3),(1,1) pour id_produit,quantite)
INSERT INTO produit_commande (id_commande, id_produit, quantite_produit)
SELECT new_cmd.id_commande, v.id_produit, v.quantite
FROM new_cmd, (VALUES ($2::int, $3::int) /* exemple placeholders */) AS v(id_produit, quantite)
    RETURNING id_produit, quantite_produit
    )

-- recalcul total
UPDATE commandes
SET total = (
    SELECT COALESCE(SUM(p.prix * pc.quantite_produit),0)
    FROM produit_commande pc
             JOIN produits p ON p.id_produit = pc.id_produit
    WHERE pc.id_commande = (SELECT id_commande FROM new_cmd)
)
WHERE id_commande = (SELECT id_commande FROM new_cmd);

-- diminuer le stock pour les produits insérés
UPDATE produits p
SET quantite_stock = p.quantite_stock - s.sold
    FROM (
  SELECT id_produit, SUM(quantite_produit) AS sold
  FROM produit_commande
  WHERE id_commande = (SELECT id_commande FROM new_cmd)
  GROUP BY id_produit
) s
WHERE p.id_produit = s.id_produit;

COMMIT;

-- Lire commandes avec items en JSON (utile pour API)
SELECT co.id_commande,
       co.id_client,
       co.date_commande,
       co.total,
       json_agg(json_build_object('id_produit', pc.id_produit, 'nom', p.nom, 'quantite', pc.quantite_produit, 'prix_unitaire', p.prix))
           FILTER (WHERE pc.id_produit IS NOT NULL) AS items
FROM commandes co
         LEFT JOIN produit_commande pc ON pc.id_commande = co.id_commande
         LEFT JOIN produits p ON p.id_produit = pc.id_produit
GROUP BY co.id_commande
ORDER BY co.date_commande DESC;

-- Mettre à jour une commande (remplacer les lignes) : transactionnelle
-- $1 = id_commande ; nouveau lines via VALUES
BEGIN;
-- restaurer le stock depuis les anciennes lignes
UPDATE produits p
SET quantite_stock = p.quantite_stock + s.sold
    FROM (
  SELECT id_produit, SUM(quantite_produit) AS sold
  FROM produit_commande
  WHERE id_commande = $1
  GROUP BY id_produit
) s
WHERE p.id_produit = s.id_produit;

-- supprimer anciennes lignes
DELETE FROM produit_commande WHERE id_commande = $1;

-- insérer nouvelles lignes (ex: (2,3),(1,1) => adapter)
WITH ins AS (
INSERT INTO produit_commande (id_commande, id_produit, quantite_produit)
SELECT $1, v.id_produit, v.quantite FROM (VALUES ($2::int, $3::int)) AS v(id_produit, quantite)
    RETURNING id_produit, quantite_produit
)

-- mettre à jour total
UPDATE commandes
SET total = (
    SELECT COALESCE(SUM(p.prix * pc.quantite_produit),0)
    FROM produit_commande pc JOIN produits p ON p.id_produit = pc.id_produit
    WHERE pc.id_commande = $1
)
WHERE id_commande = $1;


-- diminuer le stock des nouvelles lignes
UPDATE produits p
SET quantite_stock = p.quantite_stock - s.sold
    FROM (
  SELECT id_produit, SUM(quantite_produit) AS sold
  FROM produit_commande
  WHERE id_commande = $1
  GROUP BY id_produit
) s
WHERE p.id_produit = s.id_produit;

COMMIT;

-- Supprimer une commande en restaurant d'abord le stock (optionnel si ON DELETE CASCADE ne restaure pas)
BEGIN;
UPDATE produits p
SET quantite_stock = p.quantite_stock + s.sold
    FROM (
  SELECT id_produit, SUM(quantite_produit) AS sold
  FROM produit_commande
  WHERE id_commande = $1
  GROUP BY id_produit
) s
WHERE p.id_produit = s.id_produit;

DELETE FROM commandes WHERE id_commande = $1;
COMMIT;