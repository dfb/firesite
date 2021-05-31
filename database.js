// central location for loading stuff from the DB
import { writable, readable, derived } from 'svelte/store';
import { createEventDispatcher } from 'svelte';

export let firestore = null;
export let adminPageMapWatcher = null;
export let adminFileMapWatcher = null;

// must be called by app at startup - pass in a reference to firestore
export function Init(fs)
{
    firestore = fs;
    adminPageMapWatcher = MapWatcher(firestore.collection('Page'), true);
    adminFileMapWatcher = MapWatcher(firestore.collection('File'), true);
}

let watchers = [];
// tells all current watchers to start (called by user.js after successful login)
export function StartWatchers(curUser)
{
    for (var w of watchers)
    {
        if (!w.deferred)
            w.StartDB();
    }
}

// called to stop (called e.g. after logout)
export function StopWatchers()
{
    for (var w of watchers)
        w.stopDB();
}

// creates an auto-updating database object map store (the value of the store is a dict of { objID -> obj }
// if deferred=true, you have to call StartDB at some point. Otherwise, data starts coming in after a
// successful login.
export function MapWatcher(query, deferred=false)
{
    let self = writable({});
    watchers.push(self);
    self.started = false;
    self.deferred = deferred;
    self._val = {}; // our internal state
    self.query = query;
    self.unsubscribeDB = null; // func to call to stop getting DB updates
    self.StartDB = function()
    {
        if (!self.started)
        {
            self.started = true;
            self.unsubscribeDB = self.query.onSnapshot(snap =>
            {
                snap.docChanges().forEach(ch =>
                {
                    if (ch.type == 'removed')
                        delete self._val[ch.doc.id];
                    else if (ch.type == 'added' || ch.type == 'modified')
                    {
                        let d = ch.doc.data();
                        d.id = ch.doc.id;
                        self._val[d.id] = d;
                    }
                    else
                        console.log('WARNING: unhandled change type', ch.type);
                });
                self.set(self._val);
            });
        }
    }
    return self; // i.e. return the writable
}

// given a MapWatcher, returns a store that maintains a sorted array of the watcher's items
// use w.sort(x) to change the sorting, where x is a key name which can be prefixed with '-' to
// sort in reverse order (e.g. '-lastmod'). A similar value can also be specified via initialSort.
export function SortedListWatcher(mapWatcher, initialSort)
{
    let sortInfo = writable(initialSort);
    let d = derived([mapWatcher, sortInfo], function([$watcher, $sortInfo])
    {
        let items = Object.values($watcher);
        let key = $sortInfo;
        let reversed = false;
        if (key[0] == '-')
        {
            key = key.substr(1);
            reversed = true;
        }
        items.sort(function(a, b)
        {
            let va = a[key];
            if (typeof(va) === 'string')
                va = va.toLowerCase();
            let vb = b[key];
            if (typeof(vb) === 'string')
                vb = vb.toLowerCase();
            let ret = 0;
            if (va < vb)
                ret = -1;
            else if (va > vb)
                ret = 1;
            if (reversed)
                ret = ret * -1;
            return ret;
        });
        return items;
    });
    d.sort = sortInfo.set; // expose API to adjust sorting
    return d;
}

// class for caching records looked up by ID on a collection, to prevent needless fetches if the record
// was previously loaded this session. Call .Get(id) to get a promise that yields the document.
export function CollectionCache(collName)
{
    let self = this;
    self.cache = {}; // id -> record
    self.Get = function(id)
    {
        return new Promise((resolve, reject) =>
        {
            let rec = self.cache[id];
            if (rec != null) // TODO: maybe have a special "not found" value we can stick in the cache
                resolve(rec);
            else
            {
                firestore.collection(collName).doc(id).get().then(doc =>
                {
                    if (!doc.exists)
                        reject();
                    else
                    {
                        let d = doc.data();
                        d.id = id;
                        self.cache[id] = d;
                        resolve(d);
                    }
                });
            }
        });
    }

    // returns a promise to update a record both in the DB and in the local cache
    self.Update = function(id, props)
    {
        return new Promise((resolve, reject) =>
        {
            let cur = self.cache[id];
            if (cur == null)
                reject(`Attempted to update a document (${id}) that has not been loaded`);
            else
            {
                props.lastmod = new Date().getTime()/1000;
                firestore.collection(collName).doc(id).update(props).then(resp =>
                {   // update our local copy
                    self.cache[id] = Object.assign(self.cache[id], props);
                    resolve();
                });
            }
        });
    }
}

export let pageCache = new CollectionCache('Page');
export let fileCache = new CollectionCache('File');

// helper to look up a particular document from a particular collection by its
// primary ID, returning it as an object with its .id member set, or null if not
// found.
export function GetDoc(collectionName, docID)
{
    return new Promise((resolve, reject) =>
    {
        firestore.collection(collectionName).doc(docID).get().then(doc =>
        {
            let ret = null;
            if (doc.exists)
            {
                ret = doc.data();
                ret.id = doc.id;
            }
            resolve(ret);
        });
    });
}

