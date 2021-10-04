<svelte:options accessors/>
<script context="module">
let routes = []; // ordered list of objects describing routes, each has at least a .path and a .comp member
let notFoundComp = null; // the comp to render when no suitable route can be found
export function Init(_routes, _notFoundComp)
{
    routes = _routes;

    // auto-compute which ones take params
    for (let r of routes)
    {
        if (typeof r.path != 'string') // assume == regex
            r.params = r.path.toString().indexOf('(?<') != -1;
    }
    notFoundComp = _notFoundComp;
}
</script>

<script>
// handles routing, page loading, browser back/fwd button support, etc.
import { onMount } from 'svelte';
import { writable } from 'svelte/store';

onMount(() =>
{
    // on load, grab the path from the browser and load it
    let path = document.location.pathname + (document.location.hash || ''); // special case: on page load, include the hash so we can convert from site v0 SPA links
    LoadPage(path, 'replace');
});

window.onpopstate = e =>
{
    // when the user hits the back button, navigate to that page and restore the scroll position
    LoadPage(e.state ? e.state.pagePath : '', null);
    if (e.state && e.state.scroll)
        window.scrollTo(0, e.state.scroll);
};

// called anytime the user clicks anywhere on the page; inspects the click to see if it is a click on an
// anchor tag for a local link and, if so, reroutes it so we remain a SPA.
function OnAnyClick(e)
{   // let the click happen if modifiers are pressed
    if (e.shiftKey || e.ctrlKey || e.altKey || e.metaKey)
        return true;

    // see if it's an anchor tag - either this element or a parent
    let anchor = null;
    let el = e.target;
    while (el)
    {
        if (el.nodeName.toLowerCase() == 'a')
        {
            anchor = el;
            break;
        }

        el = el.parentNode;
    }
    if (!anchor)
        return true;

    // if it's an off-site link, allow it
    if (anchor.origin && anchor.origin != window.location.origin)
        return true;

    e.preventDefault();
    e.stopPropagation();

    // get the browser to play along with our fake navigation and then load the new content
    let path = anchor.getAttribute('href');
    LoadPage(path);
    return false;
}

let curComp = null;
let curParams = null;
let pageKey = 0;
// Loads a page from the DB and displays it
window.LoadPage = function(path, historyAction='push')
{
    if (path.endsWith('/'))
        path = path.substr(0, path.length-1);

    if (!path)
        path = '/';

    let search = document.location.search || '';

    let moveToTop = true;
    if (historyAction == 'push')
        history.pushState({pagePath:path+search, scroll:window.scrollY}, 'Title', path+search);
    else if (historyAction == 'replace')
        history.replaceState({pagePath:path+search, scroll:window.scrollY}, 'Title', path+search);
    else
        moveToTop = false; // popping, probably
    if (moveToTop)
        window.scrollTo(0,0);

    if (!path.startsWith('/'))
        path = '/' + path;

    // search list of routes to find the component to render
    curComp = notFoundComp;
    for (let entry of routes)
    {
        let isRE = typeof entry.path != 'string';
        if ((!isRE && entry.path == path) || (isRE && entry.path.test(path)))
        {
            curComp = entry.comp;
            curParams = null;
            if (entry.params)
                curParams = path.match(entry.path).groups;
            break;
        }
    }
    pageKey += 1; // trigger a reload even if the same comp is being used (e.g. SitePage)
}

</script>

<svelte:window on:click|capture={OnAnyClick}/>
{#key pageKey}
    {#if curParams}
    <svelte:component this={curComp} params={curParams} />
    {:else}
    <svelte:component this={curComp} />
    {/if}
{/key}

