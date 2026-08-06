# Setup Firebase — 5 minutes

## 1) Créer un projet Firebase

- Va sur https://console.firebase.google.com
- Clique **Créer un projet** → nomme-le "ardenne-heavy-merch" (peu importe)
- Désactive Google Analytics (inutile ici)

## 2) Activer Firestore

- Menu de gauche → **Build > Firestore Database**
- Clique **Créer une base de données**
- Choisis un emplacement en Europe (`eur3` par exemple)
- Démarre en **mode production**

Ensuite, va dans **Règles** et remplace tout par :

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

Publie. Oui, c'est ouvert à tous — c'est OK pour une app privée à 4 personnes.
Personne ne peut deviner l'URL du projet.

## 3) Récupérer la config

- Roue crantée (Paramètres du projet) → onglet **Général**
- Descend jusqu'à **Vos applications** → clique l'icône `</>` (Web)
- Nomme l'app "Merch Counter"
- **Ne coche pas** Hosting
- Copie l'objet `firebaseConfig` qui apparaît, il ressemble à :

```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "ardenne-heavy-merch.firebaseapp.com",
  projectId: "ardenne-heavy-merch",
  storageBucket: "ardenne-heavy-merch.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123:web:abc123"
};
```

## 4) Le mettre en secret GitHub

- Va sur https://github.com/cdricpl/Merch/settings/secrets/actions
- Clique **New repository secret**
- Nom : `VITE_FIREBASE_CONFIG`
- Valeur : le contenu de `firebaseConfig` en **JSON** (guillemets doubles !), sur **une seule ligne** :

```json
{"apiKey":"AIza...","authDomain":"ardenne-heavy-merch.firebaseapp.com","projectId":"ardenne-heavy-merch","storageBucket":"ardenne-heavy-merch.appspot.com","messagingSenderId":"123456789","appId":"1:123:web:abc123"}
```

## 5) Redéployer

Un push sur `main` déclenche automatiquement le déploiement.
Deux minutes plus tard, l'app est en ligne sur `https://cdricpl.github.io/Merch/`.

## 6) Charger le stock initial

À l'ouverture, si Firestore est vide, l'app affiche un bouton
**"Charger le stock initial"** — clique dessus une fois. Ça crée
automatiquement les 8 familles de produit (CD + T-shirts) avec les
quantités de ta note du 25/05/2026.
