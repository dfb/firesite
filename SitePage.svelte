<script context="module">
import { pageCache } from './database.js';
import admin from './admin.svelte';
import { Remarkable } from 'remarkable';
import nearley from 'nearley';
import grammar from './widget-grammar.js';
let builtinWidgets = {admin};

// set up the markdown translator, including support for custom widget syntax

// the function added to the ruler is what is called to see if the current input
// holds a widget tag and, if so, to parse it and store it
let remark = new Remarkable({html:true});

// override how <hN> tags are generated to auto-include ID generation so in-page anchors work
remark.use(rem =>
{
    rem.renderer.rules.heading_open = (tokens, idx) =>
    {
        let t = tokens[idx+1];
        if (t && t.type == 'inline')
        {
            let id = utils.Slugify(tokens[idx+1].content);
            return `<h${tokens[idx].hLevel} id="${id}">`;
        }
        return `<h${tokens[idx].hLevel}>`; // this usually (only?) happens during editing markdown
    };
});

remark.inline.ruler.enable(['ins']);

remark.inline.ruler.push('widget', (state, checkMode) =>
{   // widgets have the format {widgetName[optional args]}
    // where args are in the format of HTML attributes, e.g.
    // {mywidget url="http://blah" x="5"}
    let pos = state.pos;
    let maxPos = state.posMax;
    if (state.src.charAt(pos) != '{')
        return false;

    try {
        // find end
        let end = pos+1;
        while (1)
        {
            if (end > maxPos)
                return false;
            if (state.src.charAt(end) == '}')
                break;
            end++;
        }

        // parse the widget tag
        let content = state.src.slice(pos, end+1);
        let parser = new nearley.Parser(nearley.Grammar.fromCompiled(grammar));
        let res = parser.feed(content).results[0];
        let widget = {widget:res.widget};
        for (let [k,v] of res.args)
            widget[k] = v;
        if (!checkMode)
            state.push({type:'widget', widget});
        state.pos += content.length;
        return true;
    } catch (e)
    {
        console.log('ERROR in parsing widget:', e);
        return false;
    }
});

remark.block.ruler.before('code', 'widget', (state, startLine, endLine, silent) =>
{
    let line = state.src.slice(state.bMarks[startLine], state.eMarks[startLine]);
    let pos = state.bMarks[startLine] + state.tShift[startLine];
    let max = state.eMarks[startLine];
    if (pos+1 > max)
        return false;
    let marker = state.src.charAt(pos);
    if (state.src.charAt(pos) != '{')
        return false;

    // see if the tag ends on this line or a future line
    let curLine = startLine;
    let lines = [];
    while (1)
    {
        let line = state.src.slice(state.bMarks[curLine], state.eMarks[curLine]);
        lines.push(line);
        if (line.indexOf('}') != -1)
            break;
        if (++curLine >= state.bMarks.length)
            return false; // we got to the end of the data without finding the closing element
    }

    // we found the range of data, so emit tokens for it and update the state to point to the
    // content after the widget
    let content = lines.join('\n');
    let parser = new nearley.Parser(nearley.Grammar.fromCompiled(grammar));
    let res = parser.feed(content).results[0];
    let widget = {widget:res.widget};
    for (let [k,v] of res.args)
        widget[k] = v;
    state.tokens.push({type:'widget', widget});
    state.line = curLine+1;
    return true;
});

// expose the markup rendering function to other modules - widgets can emit markup using window.remark.render, as
// long as the markup doesn't in turn try to embed other widgets.
window.remark = remark;

let appWidgets = {}; // name -> widget component
let notFoundWidget = null; // what to show when an invalid link is passed to us
export function Init(widgetMap, _notFoundWidget)
{
    appWidgets = widgetMap;
    notFoundWidget = _notFoundWidget;
}

</script>

<script>
// The main logic for displaying pages on the site. Every page's content lives in the database and
// dynamically loaded and rendered. We use markdown for ease of editing but it's ok to dip into
// HTML as needed.

import { tick, onMount } from 'svelte';
import { writable, derived } from 'svelte/store';
import * as utils from './utils';
import * as users from './users';

let curDocID = null; // the Page.id from the DB
let origRaw = ''; // what we got from the DB, before any edits
let raw = ''; // the page data from the DB (the input)
let content = ''; // the HTML for the current page (the output)
let placeholders = []; // a list of widget info along with their placeholder div IDs

let nextCompID = 100; // each div for a svelte component gets a unique ID

// this function is called to transform a previously-parsed widget tag
// into actual HTML. Since the rendered form is a svelte component, this call
// returns the HTML for a div with a unique ID, and then saves the widget info.
// Once the markdown processing is complete and the HTML has been injected into the
// DOM, a final step will inject svelte components into the placeholder divs.
remark.renderer.rules['widget'] = (tokens, i, options, env, renderer) =>
{
    let info = tokens[i].widget;
    info.elID = nextCompID++;
    placeholders.push(info);
    return `<widget id="${info.elID}"></widget>`;
};



// called once the page record has been retrieved from the DB or cache
function _OnPageFetched(docID, content)
{
    curDocID = docID;
    placeholders = [];
    raw = content || '';
    origRaw = content || ''; // i.e. the unedited version
    UpdateContent()
}

let editorAllowed = false;
async function UpdateContent()
{
    editorAllowed = users.Is('admin');
    placeholders = [];
    content = remark.render(raw).trim();

    // remarkable wraps everything in a <p></p> tag, which kinda makes sense, but isn't what we want
    if (content.substr(0,3) == '<p>' && content.substr(content.length-4) == '</p>')
        content = content.substr(3, content.length-7);

    await tick();

    // fill in any pending placeholder divs - the placeholder array can change during processing (due to
    // recursive widgets) so we iterate by popping the first item and processing it until we're done
    while (placeholders.length > 0)
    {
        let p = placeholders.shift();

        // find the widget and instantiate it
        let klass = builtinWidgets[p.widget];
        if (!klass)
            klass = appWidgets[p.widget];
        let id = p.elID;
        delete p.elID;
        if (!klass)
            document.getElementById(id).innerHTML = `{ERROR:${JSON.stringify(p)}}`;
        else
        {
            delete p.widget;
            new klass({target:document.getElementById(id), props:p});
        }
    }

    await tick();
}

let showNotFound = false;
users.Get().then(user =>
    //onMount(() =>
{
    showNotFound = false;
    // on load, grab the path from the browser and load it
    let path = document.location.pathname + (document.location.hash || ''); // special case: on page load, include the hash so we can convert from site v0 SPA links
    if (!path || path == '/')
        path = 'index'; // special case: '/' --> 'index'
    let docID = utils.PagePathToID(path);
    pageCache.Get(docID).then(doc =>
    {
        _OnPageFetched(docID, doc.content);
    }).catch(ignore =>
    {
        // TODO: handle 404
        console.log('NO SUCH PAGE', docID);
        _OnPageFetched(null, '');
        showNotFound = true;
    });
});

$:haveEdits = origRaw != raw;
// returns the page to its original state
function ResetEdits()
{
    raw = origRaw;
    UpdateContent();
}

let dragBarEl;
let dragging = false;
let contentH = 75; // percentage of total height that goes to the content and not the editor or editor bar
function OnBarDragStart(e)
{
    dragging = true;
    dragBarEl.setPointerCapture(e.pointerId);
}

function OnBarDragMove(e)
{
    if (dragging)
    {
        let h = window.innerHeight;
        contentH = Math.max(20, Math.min(80, Math.floor(100 * e.clientY / h)));
    }
}

function OnBarDragEnd(e)
{
    dragging = false;
    dragBarEl.releasePointerCapture(e.pointerId);
}

// user pressed the Save button
let saving = false;
function SaveEdits()
{
    let userID = users.CurrentUserID();
    if (!userID)
    {
        console.log('getUser returned null; skipping saves');
        return;
    }
    saving = true;
    pageCache.Update(curDocID, {content:raw, lastmodBy:userID}).then(() =>
    {
        origRaw = raw;
        saving = false;
    });
}

function CreateMissingPage()
{
}

</script>

{#if editorAllowed}
<div style="display:flex; flex-direction:column; height:100vh">
    {#if !curDocID}
        <div>
            Page not found. <button on:click={CreateMissingPage}>Create it</button>
        </div>
    {/if}
    <div style="height:{contentH}vh; overflow:auto">
        {@html content}
    </div>
    <editorBar>
        <button disabled={!haveEdits || !curDocID} on:click={SaveEdits} >Save changes</button>
        <span style="padding-left:10px"> </span>
        <button disabled={!haveEdits} on:click={ResetEdits}>Undo all changes</button>
        {#if saving}<span class="saving">Saving...</span>{/if}
        <filler bind:this={dragBarEl} on:pointerdown={OnBarDragStart} on:pointermove={OnBarDragMove} on:pointerup={OnBarDragEnd} />
        <a target="_blank" href="https://commonmark.org/help/">[Markdown help]</a>
    </editorBar>
    <textarea style="flex:1;" bind:value={raw} on:input={UpdateContent} />
</div>
{:else if curDocID}
    {@html content}
{:else if showNotFound}
    <svelte:component this={notFoundWidget} />
{/if}

<style>
span.saving {
    padding:3px;
}

editorBar {
    display:flex;
    flex-direction:row;
    border: solid rgba(0,0,0,0.5) 1px;
    padding: 3px;
    background-color: #eee;
}
</style>

