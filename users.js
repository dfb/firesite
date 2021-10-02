import { writable } from 'svelte/store';
import sha from 'js-sha3';
import { getAuth, signInWithCustomToken, signInAnonymously } from 'firebase/auth';
import { GetDoc } from './database';

let saltPrefix = ''; // just used as extra salt when hashing passwords
let auth = null;
// called by index.Init once firebase init is done
export function Init(passwordSaltPrefix)
{
    saltPrefix = passwordSaltPrefix || 'firesite';
    auth = getAuth();
    auth.onAuthStateChanged(OnAuthStateChanged);
}

let pendingGetUser = []; // callers waiting for the current user to resolve
let waitingForInitialLogin = true; // initial load of cached anonymouse or actual user
function OnAuthStateChanged(user) // Init links this to firebase auth
{
    if (waitingForInitialLogin)
    {
        waitingForInitialLogin = false;
        if (!user)
        {
            signInAnonymously(auth).catch(err =>
            {
                console.log('Anonymous login failure', err);
                SU(null);
                _ResolvePendingGetUser();
            });
            return;
        }
        // fall through
    }

    if (!user)
    {   // nobody is logged in
        console.log('Logout complete');
        SU(null);
        _ResolvePendingGetUser();
    }
    else if (user.isAnonymous)
    {
        SU({anon:true, id:user.uid, username:'<anonymous>'});
        //console.log('Anonymous user logged in');
        _ResolvePendingGetUser();
        // TODO StartWatchers(_curUser);
    }
    else
    {   // an actual user logged in w/ cached creds
        GetDoc('User', user.uid).then(u =>
        {
            //console.log('Real user', u.id, 'logged in');
            SU(u);
            // TODO StartWatchers(u);
            _ResolvePendingGetUser();
        });
    }
}

// delivers the user object to everybody waiting on it
function _ResolvePendingGetUser()
{
    for (let resolve of pendingGetUser)
    {
        try {
            resolve(_curUser);
        } catch (e) { console.log(e); }
    }
    pendingGetUser = [];
}

let _curUser = null; // the actual current user, so we don't have to constantly get() it
export const curUser = writable(null); // a store holding a DB.User instance, or an anonymous user, or null
function SU(u) // helper - official internal way to set the current user
{
    _curUser = u;
    curUser.set(u);
}

// returns a promise that resolves the user or rejects with a message
export function Login(username, password)
{
    username = username.toLowerCase();
    return new Promise((resolve, reject) =>
    {
        let h = sha.sha3_256(saltPrefix + ':' + username + '||' + password);
        CloudCall('login', {u:username, h}).then(async resp =>
        {
            //console.log('LOGIN RESP', resp);
            if (resp.error)
            {
                console.log('Auth failed:', resp);
                return reject(resp.error);
            }

            pendingGetUser.push(resolve);
            signInWithCustomToken(auth, resp.token).then(() =>
            {   // best to just reload the page, cuz too much of the UI isn't reactive towards
                // a real user logging in
                console.log('Reloading!')
                window.location.href = '/';
            }).catch(err => // a successful login will be handled via _ResolvePendingGetUser
            {
                console.log('Tok error:', err.code, err.message);
                pendingGetUser.splice(0, 1); // eh, remove that from the callback list
                reject(err.message);
            });
        });
    });
}

// initiates the logout process
export function Logout()
{
    let anon = _curUser && _curUser.anon;
    SU(null);
    pendingGetUser = [];
    if (!anon)
        auth.signOut();
    window.location.reload();
}

// returns a promise that yields an object with info about the currently logged in user
// or null if nobody is logged in
export function Get()
{
    return new Promise((resolve, reject) =>
    {
        if (_curUser)
            resolve(_curUser);
        else
            pendingGetUser.push(resolve);
    });
}

// synchronously gets the current user - used in cases where async is inconvenient and you're
// a gazillion percent sure the user is logged in
export function SGet()
{
    return _curUser || {};
}

// returns true if the current user's role is >= minRole
export function Is(minRole)
{
    if (!_curUser || !_curUser.roles)
        return false;
    if (_curUser.roles[minRole])
        return true;

    // check for superior roles
    if (_curUser.roles.admin)
        return true;
    return false;
}

// calls IsAllowed and throws an exception if it returns false
export function Require(minRole)
{
    if (!Is(minRole))
        throw new Error('Insufficient permissions');
}

// Returns the user ID of the currently logged in user or ''
export function CurrentUserID()
{
    let u = SGet();
    if (!u)
        return '';
    return u.id || '';
}

// returns true if the current user is an anonymous user (not a member or an admin)
export function IsAnonymous()
{
    let u = SGet();
    //console.log('U?', u);
    if (!u) return true;
    if (!Is('admin') && !Is('member')) return true;
    return false;
}

// returns true if there is a real logged in user
export function IsLoggedIn()
{
    return !IsAnonymous();
}

