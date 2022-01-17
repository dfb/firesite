<script>
// main admin screen - shows a login form if user is not logged in
import { tick, onMount } from 'svelte';
import * as utils from './utils';
import * as users from './users';
import ModalUpload from './modal_upload.svelte';
import { writable, derived } from 'svelte/store';
import { DeleteDoc, SetDoc, adminPageMapWatcher, adminFileMapWatcher, SortedListWatcher } from './database.js';
import { getStorage, ref, deleteObject } from 'firebase/storage';

/*
LATER
- make this a modal instead of a separate page
- make it easy for firesite apps just display a quick admin UI button in their header or whatever, and a logout button
- keyword search on images
- let the user rename from the original filename
- usedby - show all pages that have this ID in their text (we have all the pages loaded in memory so...)
- overwrite upload warns


*/

let loggingIn = false;
let userType = null; // null, 'anon', 'member', 'admin'
users.Get().then(u =>
{
    loggingIn = false;
    if (users.Is('admin'))
        userType = 'admin';
    else if (users.Is('member'))
        userType = 'member';
    else if (!users.IsLoggedIn())
        userType = 'anon';
});

function Logout()
{
    users.Logout()
    userType = null;
}

let username = '';
let password = '';
let errMsg = '';
function Login()
{
    errMsg = '';
    loggingIn = true;
    users.Login(username, password).then(() =>
    {
        loggingIn = true;
    },
    err =>
    {
        loggingIn = false;
    });
}

$:if (userType == 'admin')
{
    adminPageMapWatcher.StartDB();
    adminFileMapWatcher.StartDB();
    setTimeout(()=>
    {
        SelectTab(TAB_PAGES);
    });
}

const [TAB_PAGES, TAB_FILES] = [0,1];
let tabs = ['Pages', 'Files'];
let curTab = writable(TAB_PAGES);
function SelectTab(n)
{
    curRec = null;
    $curTab = n;
    $filterText = '';
    filterEl.focus();
}

let filterEl;
let filterText = writable('');
let sortedPages = SortedListWatcher(adminPageMapWatcher, 'id');
let sortedFiles = SortedListWatcher(adminFileMapWatcher, 'orig');
let filteredRecords = derived([curTab, filterText, sortedPages, sortedFiles], ([$tab, $f, $pages, $files]) =>
{
    // select the record set to use as a source based on which tab is selected
    let $records;
    if ($tab == TAB_PAGES)
        $records = $pages;
    else
        $records = $files;

    let ret = [];
    let parts = $f.toLowerCase().split(' ');
    for (let rec of $records)
    {
        let allMatch = true;
        for (let part of parts)
        {
            if ($tab == TAB_PAGES)
            {
                let id = utils.PageIDToPath(rec.id).toLowerCase();
                if (id.indexOf(part) == -1)
                {
                    allMatch = false;
                    break;
                }
            }
            else
            {
                let found = false;
                if (rec.id.toLowerCase().indexOf(part) >= 0)
                    found = true;
                else if (rec.orig.toLowerCase().indexOf(part) >= 0)
                    found = true;
                if (!found)
                {
                    allMatch = false;
                    break;
                }
            }
        }

        if (!allMatch)
            continue;
        ret.push(rec);
    }
    return ret;
});

let curRec = null;
function ShowDetails(page)
{
    curRec = page;
}

const BAD_CHARS = ' :;`\'"\\=+?()*&^%$#@!<>,.';
let filterTextIsValidRecordName = derived([filterText], ([$f]) =>
{
    let s = $f.trim().toLowerCase();
    if (s.length == 0)
        return false;
    if (s.indexOf('__') != -1)
        return false;
    for (let bad of BAD_CHARS)
    {
        if (s.indexOf(bad) != -1)
            return false;
    }
    return true;
});

$:preventCreate = !$filterTextIsValidRecordName || $adminPageMapWatcher[utils.PagePathToID($filterText)] != null;
function CreatePage()
{
    // TODO: confirmation dialog
    let docID = utils.PagePathToID($filterText);
    let now = utils.Now();
    let args = {created:now, lastmod:now, content:''}

    SetDoc('Page', docID, args).then(res =>
    {
        args.id = docID;
        ShowDetails(args);
    });
}

// given a record, returns the string to display in the list view
function RecordDisplayName(rec)
{
    if ($curTab == TAB_PAGES)
        return utils.PageIDToPath(rec.id).substr(1);
    else
        return rec.orig;
}

function UploadNewFile(overwriteID=null)
{
    OpenModal(ModalUpload, {overwriteID}).then(async res =>
    {
        if (res.closeCode != MODAL_OK) return;
        let fileID = res.comp.uploadedFile.id;
        $filterText = '';
        await tick()
        for (let rec of $filteredRecords)
        {
            if (rec.id == fileID)
            {
                console.log('yeah yeah', fileID, rec);
                ShowDetails(rec);
                break;
            }
        }
    });
}

function DeleteFile()
{
    OpenConfirmModal('Are you sure you want to delete this file? This action cannot be undone.', 'Confirm delete').then(res =>
    {
        if (res.closeCode != MODAL_OK) return;
        let docID = curRec.id;
        let storagePath = curRec.storagePath;
        curRec = null;
        console.log('Deleting', docID, storagePath);
        OpenBusyModal('Deleting...');
        deleteObject(ref(getStorage(), storagePath)).then(() => // first delete from storage
        {   // now delete DB record
            DeleteDoc('File', docID).then(() =>
            {
                CloseModal();
            });

        }).catch(err => {
            CloseModal();
            console.log('Storage deletion failed:', err);
            OpenAlertModal('Failed to delete file. Please try again.');
        });
    });
}

</script>

<p>
{#if loggingIn || userType == null}
Loading...
{:else if userType != 'admin'}
    <input placeholder="username" bind:value={username} />
    <input placeholder="password" type="password" bind:value={password} />
    <button disabled={username==''||password==''} on:click={Login}>Login</button>
    <br/>{errMsg}
{:else if userType == 'admin'}
    <tabs>
        {#each tabs as tab,i}
            <tab class:selected={$curTab==i} on:click="{()=>SelectTab(i)}">{tab}</tab>
        {/each}
        <filler/>
        <button on:click={Logout}>Logout</button>
    </tabs>
    <records>
        <searchbar>
            <input type="text" placeholder="Start typing to filter" bind:value={$filterText} bind:this={filterEl} />
            {#if $curTab == TAB_PAGES}
            <button disabled={preventCreate} on:click={CreatePage}>Create page</button>
            {:else if $curTab == TAB_FILES}
            <button on:click={()=>UploadNewFile(null)}>Upload file</button>
            {/if}
        </searchbar>
        <recordinfoarea>
            <recordlist>
                <ul>
                {#each $filteredRecords as record}
                    <li class:selected={curRec && curRec.id==record.id} on:click="{()=>ShowDetails(record)}">{RecordDisplayName(record)}</li>
                {/each}
                </ul>
            </recordlist>
            <recorddetails>
                {#if !curRec}
                    Select an item on the left to see details about it.
                {:else if $curTab == TAB_PAGES}
                    <h4>{utils.PageIDToPath(curRec.id)}</h4>
                    <a href="{utils.PageIDToPath(curRec.id)}">[View]</a>
                {:else if $curTab == TAB_FILES}
                    <b>ID: </b> {curRec.id} <b>Type: </b> {curRec.type}
                    {#if curRec.w && curRec.h}({curRec.w} x {curRec.h}){/if}
                    <b>Size: </b>{utils.FileSizeStr(curRec.size||0)}
                    <br/>
                    <button on:click={()=>UploadNewFile(curRec.id)}>Upload new version</button>
                    <button on:click={DeleteFile}>Delete this file</button>
                    <br/><b>Orig filename: </b> {curRec.orig} <a href="{curRec.url}" target="_blank">[link]</a>
                    <br/>
                    {#if curRec.type == 'image'}
                    <img class="preview" src="{curRec.url}" alt="curRec"/>
                    {/if}
                {/if}
            </recorddetails>
        </recordinfoarea>
    </records>
{/if}
</p>

<style>
tabs {
    display:flex;
}

tab {
    display:inline-block;
    border-top:solid black 1px;
    border-left:solid black 1px;
    border-right:solid black 1px;
    padding:5px;
    width:100px;
    cursor:pointer;
}

tab.selected {
    font-weight:bold;
    font-style:italic;
}

img.preview {
    object-fit:contain;
    width:600px;
    height:400px;
}

records {
    display:block;
    margin-top:0;
    border:solid black 1px;
    padding:0.5em;
}

recordinfoarea {
    border-top:solid black 1px;
    margin-top:0.5em;
    display:flex;
}

recordlist {
    display:block;
    overflow-x:hidden;
    overflow-y:scroll;
    width:35ch;
    height:70vh;
}

recordlist ul {
    margin-block-start:0;
    margin-block-end:0;
    padding-inline-start:0;
}

recordlist li {
    white-space: nowrap;
    list-style-type: none;
    cursor:pointer;
}

recordlist li.selected {
    font-weight:bold;
}

recordlist li:hover {
    background-color: #ccc;
}

recorddetails {
    display:block;
    padding:1em;
}
</style>
