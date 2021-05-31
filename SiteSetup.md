# How to create a website from scratch 
*(or: I'm annoyed each time I start a new site and have to look this up)*

1. Create a new dir and create an empty svelte app
    1. npx degit sveltejs/template mytestsite
    1. cd mytestsite
    1. npm i

1. Add Firebase support to your project
    1. npm i --save-dev firebase
    1. firebase login
    1. Optionally: "firebase login:ci" and then save the results to a file like:
        export FIREBASE_TOKEN=...
        so you can do 'source thatfile'. If you go this route, **do not** check that file into your repository!
    1. firebase init
        1. choose at least Firestore, Hosting, and Storage
        1. choose 'yes' when prompted about configuring it as a single-page app.
    1. Create a src/firebase.js (or some such) file in your project that initializes the Firebase app:
        ```js
        import firebase from "firebase/app";
        import "firebase/firestore"; // add other imports as needed, e.g. firebase/auth
        const cfg = {...}; // see https://firebase.google.com/docs/web/setup#config-object
        const app = firebase.initializeApp(cfg);
        const firestore = firebase.firestore(app);
        export { app, firestore, firebase };
        ```
    1. Edit firestore.rules to include (a) an admin role and (b) read/write access to File and Page collections:
        ```
        service cloud.firestore
        {
          match /databases/{database}/documents
          {
            function isAdmin() { return request.auth.token.roles.admin == 1; }
            match /File/{document=**}
            {
                allow read;
                allow write: if isAdmin();
            }

            match /Page/{document=**}
            {
                allow read;
                allow write: if isAdmin();
            }

            match /User/{userID} { allow read: if request.auth.uid == userID; }
          }
        }
        ```

1. Add firesite
    1. npm i --save-dev https://github.com/dfb/firesite
    1. In your App.svelte (or some other entry point that always gets loaded), import and initialize firesite:
    ```js
    import firesite from 'firesite';
    import { firestore } from './firebase.js'; // or some other way to get firebase.firestore(app)
    firesite.Init(firestore, widgetMap, userFuncs, pathRewriter);
    ```
    (see firesite/index.js for more info on the parameters)
    1. Also in your App.svelte, render the SitePage widget:
    ```js
    import SitePage from 'firesite/SitePage.svelte';
    ...
    <SitePage />
    ```
    1. Optionally put a link to `/admin` somewhere on your site to get to the admin page (it will show a login
    prompt as needed).

1. TODO: first run, go to admin and create index page.
1. TODO: Create custom widgets

