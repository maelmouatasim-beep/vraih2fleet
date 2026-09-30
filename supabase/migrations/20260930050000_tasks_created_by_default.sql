-- Revue E4 (parcours complet) : « Générer les tâches du plan » (étape
-- Suivi) était refusé en 403. La policy INSERT de tasks exige
-- created_by = auth.uid() (20260929030000) mais la colonne n'avait pas de
-- défaut : toute insertion qui ne la renseigne pas échouait.
-- Additif : le défaut est l'appelant ; la policy reste inchangée (on ne
-- peut toujours pas créer une tâche au nom d'un autre utilisateur).

ALTER TABLE public.tasks ALTER COLUMN created_by SET DEFAULT auth.uid();
