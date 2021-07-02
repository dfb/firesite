// Main entry point for firesite
import { pageCache, fileCache, Init as DBInit } from './database.js';

let firesite = {pageCache, fileCache};

firesite.userFuncs = { // dummy implementations
    getUser:() => null,
    doLogin:(u, p) => new Promise((resolve, reject) => reject('Not implemented')),
    doLogout:() => new Promise((resolve,reject) => resolve()),
}
firesite.widgetMap = {}; // widget name --> svelte component to render for that widget

// the default path rewriter is a no-op
firesite.RewritePath = function(path) { return path; }

// called by applications on startup. Parameters:
// fs - firestore instance
// widgetMap holds the custom Svelte components that can be used in the markdown for
//  each page.
// pathRewriter is an optional callback that gives the app a chance to rewrite URLs
//  (e.g. update legacy URLs that have changed).
// userFuncs is an object with the following session-related functions that the app
// provides:
// .getUser() - gets the current user. This controls whether or not editing is allowed; if
//  null is returned, no editing is allowed, otherwise the return value should be an object
//  that has an .id member, representing the current user's ID.
// .doLogin(username, password) - the admin screen will display a login form if the
//  screen is accessed but there is no user (getUser returned null). When the user attempts
//  to log in, firesite will call doLogin to have the application handle the login process;
//  it returns a promise that resolves/rejects.
// .doLogout() - for logged in users, the admin page will include a logout button so that
//  the app can perform the logout; it should return a promise that resolves once it's done.
firesite.Init = function(fs, widgetMap, userFuncs, pathRewriter)
{
    DBInit(fs);
    firesite.widgetMap = Object.assign({}, widgetMap);
    firesite.userFuncs = userFuncs;
    if (pathRewriter)
        firesite.RewritePath = pathRewriter;
}

firesite.UUID = function()
{
    return _UUID().replace(/-/g, '');
}

// returns a current timestamp in seconds since the epoch
firesite.Now = function()
{
    return new Date().getTime()/1000;
}

// trims and lowercases a string, replaces spaces with underscores
firesite.Slugify = function(s)
{
    return s.trim().replaceAll(' ', '_').toLowerCase().replaceAll('(', '').replaceAll(')', '');
}

// given a page ID like 'foo__bar', converts it to a path like 'foo/bar'
const RE_FIND_DOUBLE_UNDER = new RegExp('__', 'g');
firesite.PageIDToPath = function(id)
{
    return '/' + id.replace(RE_FIND_DOUBLE_UNDER, '/');
}

// opposite of PageIDToPath
const RE_FIND_SLASHES = new RegExp('/', 'g');
firesite.PagePathToID = function(path)
{
    if (path[0] == '/')
        path = path.substr(1);
    return path.replace(RE_FIND_SLASHES, '__');
}

export default firesite;

