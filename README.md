# Espace de demande de congés – Paroisse Notre-Dame du Bon Secours

App Next.js : demandes de congés (avec demi-journées), validation par lien
magique (1 approbation suffit), copie aux membres CPAE, et PDF récapitulatif
— reproduisant le formulaire officiel de la paroisse — envoyé par mail à la
validation comme au refus. Mails via Gmail (SMTP).

## Rôles
- Salariées : login email + mot de passe (Supabase Auth)
- Approbateurs (5) : pas de compte, agissent via lien dans le mail
- Membres CPAE (10) : reçoivent les copies, ne valident pas

## Fonctionnement des congés
- La salariée choisit dates de début/fin + matin / après-midi / journée entière.
- Le système calcule automatiquement le nombre de jours ouvrés et la date de
  reprise (en sautant week-ends et jours fériés Réunion, dont le 20/12).
- Le PDF généré coche la bonne nature de congé et la décision (Accordé/Refusé),
  et remplace les signatures par nom + date (soumission côté salarié,
  décision côté approbateur).

## Jours fériés
La liste est dans `lib/dateConges.ts` (constante JOURS_FERIES). À compléter
chaque année — les fériés mobiles (Pâques, Ascension, Pentecôte) changent.

## Variables d'environnement (Vercel)
Voir `.env.example`. Les 6 clés :
- NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY
- GMAIL_USER / GMAIL_APP_PASSWORD (mot de passe d'application, SANS espaces)
- NEXT_PUBLIC_BASE_URL (URL Vercel finale)

## Base de données
- Base NEUVE : exécuter `supabase_schema.sql`.
- Base DÉJÀ créée (cas actuel) : exécuter `migration.sql` (ajoute les colonnes
  moment_debut/moment_fin/date_reprise et aligne les types de congé).

## Déploiement (navigateur)
1. Déposer ces fichiers dans un dépôt GitHub.
2. Vercel → New Project → importer le dépôt.
3. Coller les 6 variables d'environnement.
4. Deploy, puis remettre la vraie URL dans NEXT_PUBLIC_BASE_URL et redéployer.

## Création des comptes salariées
Supabase → Authentication → Add user (email + mot de passe), puis :
  insert into profiles (id, nom_complet, email)
  values ('<uuid-auth>', 'Prénom Nom', 'email@exemple.com');

## Logo
`lib/logo.png` = logo de la paroisse, repris du modèle Word.
