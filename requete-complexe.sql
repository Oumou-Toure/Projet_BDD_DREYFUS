--TOTAL VENDU ET CHIFFRE D'AFFAIRE PAR PRODUIT

SELECT p.id_produit,
       p.nom,
       SUM(pc.quantite_produit)                        AS total_qty,
       SUM(pc.quantite_produit * pc.prix_unitaire)     AS total_revenue
FROM produit_commande pc
JOIN produits p ON p.id_produit = pc.id_produit
GROUP BY p.id_produit, p.nom
ORDER BY total_revenue DESC
LIMIT 20;



--TOP 10 CLIENT PAR MONTANT DEPENSES

SELECT c.id_client,
       c.nom,
       c.email,
       SUM(pc.quantite_produit * pc.prix_unitaire)    AS total_spent,
       COUNT(DISTINCT co.id_commande)                 AS commandes_count
FROM clients c
JOIN commandes co ON co.id_client = c.id_client
JOIN produit_commande pc ON pc.id_commande = co.id_commande
GROUP BY c.id_client, c.nom, c.email
ORDER BY total_spent DESC
LIMIT 10;

--REVENUES MENSUEL DES 12 DERNIER MOIS


SELECT date_trunc('month', co.date_commande) AS month,
       SUM(pc.quantite_produit * pc.prix_unitaire) AS revenue,
       COUNT(DISTINCT co.id_commande)              AS orders_count
FROM commandes co
JOIN produit_commande pc ON pc.id_commande = co.id_commande
WHERE co.date_commande >= (date_trunc('month', CURRENT_DATE) - INTERVAL '11 months')
GROUP BY month
ORDER BY month DESC;

--MOYENNE MEDIANDE DE LA VALEUR DES COMMANDES


WITH order_totals AS (
  SELECT co.id_commande,
         SUM(pc.quantite_produit * pc.prix_unitaire) AS total
  FROM commandes co
  JOIN produit_commande pc ON pc.id_commande = co.id_commande
  GROUP BY co.id_commande
)
SELECT AVG(total) AS avg_order,
       PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total) AS median_order,
       COUNT(*) AS nb_orders
FROM order_totals;

--PRODUIT EN STOCK FAIBLE AVEC DERNIERE VENTE ET VENTE 30 DERNIER JOURS

SELECT p.id_produit,
       p.nom,
       p.quantite_stock,
       MAX(co.date_commande) AS last_sold_at,
       COALESCE(SUM(CASE WHEN co.date_commande >= now() - INTERVAL '30 days' THEN pc.quantite_produit ELSE 0 END), 0) AS sold_last_30d
FROM produits p
LEFT JOIN produit_commande pc ON pc.id_produit = p.id_produit
LEFT JOIN commandes co ON co.id_commande = pc.id_commande
GROUP BY p.id_produit, p.nom, p.quantite_stock
HAVING p.quantite_stock < 10
ORDER BY p.quantite_stock ASC, sold_last_30d DESC;

--COMMANDE AVEC ITEM IMBRIQUES

SELECT co.id_commande,
       co.id_client,
       co.date_commande,
       co.total,
       json_agg(
         json_build_object(
           'id_produit', pc.id_produit,
           'nom', p.nom,
           'quantite', pc.quantite_produit,
           'prix_unitaire', pc.prix_unitaire
         ) ORDER BY pc.id_produit
       ) FILTER (WHERE pc.id_produit IS NOT NULL) AS items
FROM commandes co
LEFT JOIN produit_commande pc ON pc.id_commande = co.id_commande
LEFT JOIN produits p ON p.id_produit = pc.id_produit
GROUP BY co.id_commande, co.id_client, co.date_commande, co.total
ORDER BY co.date_commande DESC
LIMIT 50;

--VENTE HEBDO PAR PRODUIT

WITH weekly AS (
  SELECT date_trunc('week', co.date_commande)::date AS week_start,
         pc.id_produit,
         p.nom,
         SUM(pc.quantite_produit) AS qty
  FROM produit_commande pc
  JOIN commandes co ON co.id_commande = pc.id_commande
  JOIN produits p ON p.id_produit = pc.id_produit
  GROUP BY week_start, pc.id_produit, p.nom
)
SELECT week_start,
       id_produit,
       nom,
       qty,
       ROUND(AVG(qty) OVER (PARTITION BY id_produit ORDER BY week_start ROWS BETWEEN 2 PRECEDING AND CURRENT ROW), 2) AS ma_3_weeks
FROM weekly
ORDER BY week_start DESC, qty DESC
LIMIT 100;
