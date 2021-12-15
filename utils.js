// misc helpers
// this module should have zero dependencies upon other modules in this prj (depending on 3rd party modules
// (e.g. stuff installed via npm) is fine though)

export function UUID() // technically this doesn't confirm to the GUID RFC, but for our purposes, it's fine
{
    let values = new Uint8Array(16);
    window.crypto.getRandomValues(values);
    return Array.from(values, b => ('0' + b.toString(16)).slice(-2)).join('');
}

export function Now()
{
    return new Date().getTime()/1000;
}

// trims and lowercases a string, replaces spaces with underscores
export function Slugify(s)
{
    return s.trim().replaceAll(' ', '_').toLowerCase().replaceAll('(', '').replaceAll(')', '');
}

// given a page ID like 'foo__bar', converts it to a path like 'foo/bar'
const RE_FIND_DOUBLE_UNDER = new RegExp('__', 'g');
export function PageIDToPath(id)
{
    return '/' + id.replace(RE_FIND_DOUBLE_UNDER, '/');
}

// opposite of PageIDToPath
const RE_FIND_SLASHES = new RegExp('/', 'g');
export function PagePathToID(path)
{
    if (path[0] == '/')
        path = path.substr(1);
    return path.replace(RE_FIND_SLASHES, '__');
}

// given a number of bytes, returns a nicer-looking string in KB/MB/GB
export function FileSizeStr(n)
{
    if (n < 1024) return n + ' bytes';
    n = Math.round(n / 1024);
    if (n < 1024) return n + ' KB';
    n = Math.round(n / 1024);
    return n + ' MB';
}


