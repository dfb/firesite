// Helpers for accessing Firestore
import { writable, readable, derived } from 'svelte/store';
import { getFirestore, collection, doc, query, where, limit, getDoc, setDoc, updateDoc, onSnapshot, connectFirestoreEmulator } from 'firebase/firestore';

let firestore = null;
export { firestore, query, where, limit, collection };

// called by index.Init once the firebase has been initialized
export function Init()
{
    firestore = getFirestore();
    if (IN_DEV)
        connectFirestoreEmulator(firestore, 'localhost', 5002);
    adminPageMapWatcher = MapWatcher(query(collection(firestore, 'Page')), true);
    adminFileMapWatcher = MapWatcher(query(collection(firestore, 'File')), true);
}

// helper that takes a firestore query for a list of documents and returns them as a list of
// objects with their .id member set.
export function GetDocs(query, limit=null)
{
    if (limit != null)
        query = query.limit(limit);
    return query.get().then(res =>
    {
        let ret = [];
        for (let d of res.docs)
        {
            let obj = d.data();
            obj.id = d.id;
            ret.push(obj);
        }
        return ret;
    })
}

// like GetDocs, but for retrieving a single document. Can be called in two ways:
// - GetDoc(query) - same as GetDocs
// - GetDoc(colName, ID) - for when you know the primary ID
export async function GetDoc(collectionNameOrQuery, docID)
{
    if (typeof collectionNameOrQuery === 'string')
    {   // lookup by primary key
        let docRef = doc(firestore, collectionNameOrQuery, docID);
        let docSnap = await getDoc(docRef);
        if (!docSnap.exists()) return null;
        let d = docSnap.data();
        d.id = docSnap.id;
        return d;
    }
    else
    {   // a query
        return GetDocs(collectionNameOrQuery, 1).then(docs =>
        {
            if (docs && docs.length)
                return docs[0];
            return null;
        });
    }
}

// creates an auto-updating database object map store (the value of the store is a dict of { objID -> obj }
// if deferred=true, you have to call StartDB at some point. Otherwise, data starts coming in after a
// successful login.
// NOTE: for now, all watchers are deferred (manually started) - waiting to see if we want auto-starting ones or not
export function MapWatcher(theQuery, deferred=false)
{
    let self = writable({});
    self.started = false;
    self.deferred = deferred;
    if (!deferred)
        console.log('ERROR: support for auto-starting MapWatchers has not yet been implemented');
    self._val = {}; // our internal state
    self.query = theQuery;
    self.unsubscribeDB = null; // func to call to stop getting DB updates
    self.StartDB = function()
    {
        if (!self.started)
        {
            self.started = true;
            self.unsubscribeDB = onSnapshot(self.query, snap =>
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
                GetDoc(collName, id).then(doc =>
                {
                    if (doc == null)
                        reject();
                    else
                    {
                        self.cache[id] = doc;
                        resolve(doc);
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
                let docRef = doc(firestore, collName, id);
                updateDoc(docRef, props).then(() =>
                {   // update our local copy
                    self.cache[id] = Object.assign(self.cache[id], props);
                    resolve();
                });
            }
        });
    }
}

// TODO: these shouldn't live here but in some session-common file
export let pageCache = new CollectionCache('Page');
export let fileCache = new CollectionCache('File');
export let adminPageMapWatcher = null;
export let adminFileMapWatcher = null;

