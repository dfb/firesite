// Low level initialization of the Firebase SDK
import { initializeApp } from 'firebase/app';
import { getStorage, ref} from 'firebase/storage';

// figure out which environment we're running in. By default, we'll let rollup modify the following variable
// so that it correctly holds the value 'dev' or 'prod':
let ENV_NAME = (import.meta.env.MODE == 'development') ? 'dev' : 'prod';
let inBuild = ENV_NAME == 'prod';

// allow forcing prod from the command line via VITE_FORCE_PROD=1
if (ENV_NAME == 'dev' && import.meta.env.VITE_FORCE_PROD == '1')
{
    console.log('WARNING: overriding dev env and hitting prod resources due to env var!')
    ENV_NAME = 'prod';
}

// if we are in dev, allow hitting prod resources via ?prod=1 on the URL
if (ENV_NAME == 'dev')
{
    let params = Object.fromEntries(new URLSearchParams(location.search));
    if (params.prod == '1')
    {
        console.log('WARNING: overriding dev env and hitting prod resources due to URL param!')
        ENV_NAME = 'prod';
    }
}

// set official global vars
export const IN_PROD = (ENV_NAME == 'prod');
export const IN_DEV = !IN_PROD;
export const IN_BUILD = inBuild;
window.IN_DEV = IN_DEV;
window.IN_PROD = IN_PROD;
window.IN_BUILD = IN_BUILD;

export let app = null; // the Firebase app instance
export let storage = null;
export let API_URL = ''; // the API to use to call cloud functions

export function Init(firebaseConfig, devFuncURL, prodFuncURL)
{
    if (!firebaseConfig)
        console.log('ERROR: firebaseConfig required for firebase.Init');
    app = initializeApp(firebaseConfig);
    storage = getStorage();

    if (devFuncURL && IN_DEV)
        API_URL = devFuncURL;
    else if (prodFuncURL && IN_PROD)
        API_URL = prodFuncURL;
    else
        console.log('WARNING: no API URL specified for current environment', ENV_NAME);
}

