-- CLIENTS
-- Create
INSERT INTO clients (nom, email, adresse, telephone) VALUES ($1, $2, $3, $4) RETURNING id_client;

-- Read all
SELECT * FROM clients ORDER BY id_client;

-- Read by id
SELECT * FROM clients WHERE id_client = $1;

-- Update
UPDATE clients
SET nom = COALESCE($2, nom),
    email = COALESCE($3, email),
    adresse = COALESCE($4, adresse),
    telephone = COALESCE($5, telephone)
WHERE id_client = $1
RETURNING *;

-- Delete
DELETE FROM clients WHERE id_client = $1;