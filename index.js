// Main entry point for all things Firesite.

import * as firebase from './firebase';
import { getAuth, setPersistence } from 'firebase/auth';
import * as database from './database';
import * as users from './users';
import * as Router from './router.svelte';

let auth = null;
export function Init({firebaseConfig, devFuncURL, prodFuncURL, routes, notFoundComp})
{
    firebase.Init(firebaseConfig, devFuncURL, prodFuncURL);
    database.Init();
    users.Init();
    auth = getAuth();
    Router.Init(routes, notFoundComp)
}

export { firebase, auth, database, users };

// Runs the given sub-function on the perp-man cloud function. Returns a promise that
// yields the result object. If something went wrong, the returned object will have a
// truthy .error member. If anon is set, the call is made anonymously.
window.CloudCall = function(name, params={}, anon=false)
{
    return new Promise(async (resolve, reject) =>
    {
        let body = {action:name, payload:params};
        if (!anon)
        {
            let cu = auth.currentUser;
            if (cu)
                body.auth = await cu.getIdToken();
        }
        body = JSON.stringify(body);
        fetch(firebase.API_URL, {method:'POST', headers:{'Content-Type':'application/json'}, body}).then(async resp =>
        {
            let body = await resp.json();
            resolve(body);
        }).catch(err => resolve({error:err.message}));
    });
}

