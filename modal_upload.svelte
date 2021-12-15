<svelte:options accessors/>
<script>
// Modal for uploading files, with extra functionality for images (preview, resize-before-upload)
import Modal from './modal.svelte';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { FileSizeStr, Now, UUID } from './utils.js';
import { SetDoc, UpdateDoc, DeleteDoc } from './database.js';

export let overwriteID = null; // in: if provided, upload will override the existing File entry
export let uploadedFile = null; // out: on successful upload, the File object from the DB

let uploading = false;
function OnClose(withCode)
{
    return withCode == MODAL_OK || withCode == MODAL_CANCEL || !uploading;
}

let canvasEl;
let filesEl = null;
let inputImg = new Image();
let inputInfo = {isImage:false, width:0, height:0, ar:1, filename:'', size:0, sizeStr:'0 KB'};
inputImg.onload = e=>
{
    URL.revokeObjectURL(e.target.src); // free the mem
    inputInfo.width = inputImg.width;
    inputInfo.height = inputImg.height;
    inputInfo.ar = inputImg.width / inputImg.height;
    ResetResize();
    ResetCanvasResize();
}

function OnUploadInputChange()
{
    let files = filesEl.files;
    if (!files.length)
        return
    let file = files[0];

    // use an image element to pull the data off disk and so we can inspect it for resizing
    let blob = new Blob([file], {'type':file.type});
    inputInfo.filename = file.name;
    inputInfo.size = file.size;
    inputInfo.sizeStr = FileSizeStr(file.size);
    inputInfo.isImage = file.type.startsWith('image/');
    if (inputInfo.isImage)
        inputImg.src = URL.createObjectURL(blob);
}

let resizeW = 0, resizeH = 0, displayW=500;
let lastResizeW = -1, lastResizeH = -1;
let curAR = 1;
let compressedBlob = null; // the scaled, compressed image, as a Blob
let compressedSizeStr = '';
$:readyForUpload = (inputInfo.size && (!inputInfo.isImage || !!compressedBlob));
$:if (resizeW != -1 && resizeH != -1) TriggerResize();
$:if (displayW != -1) TriggerCanvasResize();

// called each time the resize inputs are changed
function TriggerResize()
{
    if (!inputInfo.isImage) return;

    // if user changed W, auto-calc H, and vice versa
    if (resizeW != lastResizeW)
        resizeH = Math.max(1, Math.round(resizeW / inputInfo.ar));
    else if (resizeH != lastResizeH)
        resizeW = Math.max(1, Math.round(resizeH * inputInfo.ar));

    if (resizeW <= 0 || resizeH <= 0 || displayW <= 0)
        return;

    compressedBlob = null;
    lastResizeW = resizeW;
    lastResizeH = resizeH;
    curAR = resizeW / resizeH;
    TriggerCanvasResize();

    createImageBitmap(inputImg, {resizeQuality:'high', resizeWidth:resizeW, resizeHeight:resizeH}).then(img =>
    {
        canvasEl.width = resizeW;
        canvasEl.height = resizeH;
        let ctx = canvasEl.getContext('2d');
        ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
        ctx.drawImage(img, 0, 0);
        canvasEl.toBlob(res =>
        {
            compressedSizeStr = FileSizeStr(res.size);
            compressedBlob = res;
        }, 'image/jpeg');
    })
}

function TriggerCanvasResize()
{
    if (canvasEl && curAR > 0)
    {
        canvasEl.style.width = displayW + 'px';
        canvasEl.style.height = Math.round(displayW/curAR) + 'px';
    }
}

// restores resize parameters to those of the original image
function ResetResize()
{
    resizeW = lastResizeW = inputInfo.width;
    resizeH = lastResizeH = inputInfo.height;
}

function ResetCanvasResize()
{
    displayW = Math.max(10, Math.min(resizeW, 500));
}

function DoUpload()
{
    uploading = true;
    OpenBusyModal('Uploading file', true); // true=show progress bar
    let uuid = overwriteID ? overwriteID : UUID(); // TODO: if provided, look for that File obj to preserve its info, e.g. .created (maybe we don't care?)

    // because we're hitting two different resources (Firestore and Google Storage), we can't both create the DB record and
    // upload the file in a single transaction, so we create the DB record with uploadDone=false, then upload the file, then
    // update uploadDone=true in the DB, deleting that DB record if the upload got aborted.
    let now = Now();
    let ext = inputInfo.filename.split('.').pop().toLowerCase();
    let storagePath = `assets/${uuid}.${ext}`;
    console.log('Uploading to', storagePath);
    let url = '';
    let type = inputInfo.isImage ? 'image' : 'file';
    let args = {created:now, lastmod:now, orig:inputInfo.filename, storagePath, size:inputInfo.size, type, url,
                w:inputInfo.width, h:inputInfo.height, uploadDone:false};
    SetDoc('File', uuid, args).then(() =>
    {
        console.log('DB record created, starting upload');
        let storageRef = ref(getStorage(), storagePath);
        let uploadTask = uploadBytesResumable(storageRef, compressedBlob);
        uploadTask.on('state_changed', snapshot =>
        {
            UpdateModal({percent:100 * snapshot.bytesTransferred / snapshot.totalBytes});
        },
        err =>
        {
            console.log('Upload error:', err);
            DeleteDoc('File', uuid).then(() =>
            {
                uploading = false;
                OpenAlertModal('The upload failed; please try again.', 'Error');
            });
        },
        () =>
        {   // upload finished successfully, so mark the upload as done and close the modal
            UpdateModal({percent:100});
            console.log('Upload completed successfully; marked upload complete in DB.');
            getDownloadURL(uploadTask.snapshot.ref).then(url =>
            {
                UpdateDoc('File', uuid, {uploadDone:true, url}).then(() =>
                {
                    CloseModal(); // this closes the progress modal
                    uploadedFile = Object.assign(args, {id:uuid, uploadDone:true, url});
                    CloseModal(); // this closes the upload modal
                });
            });
        });
    });
}
</script>

<Modal close={OnClose}>
    <h2>Upload a file</h2>
    <content>
        <form name="uploadForm">
            <input id="uploadInput" type="file" disabled={uploading} bind:this={filesEl} on:change={OnUploadInputChange}>
        </form>
        {#if inputInfo.size}
            {#if inputInfo.isImage}
            <hbox class="center">Original: {inputInfo.sizeStr}, {inputInfo.width} x {inputInfo.height}</hbox>
            <hbox class="center">
                Resized: {compressedSizeStr},
                <input class="num" type="text" disabled={uploading} bind:value={resizeW}/> x <input class="num" type="text" bind:value={resizeH} disabled={uploading} />
                <button disabled={uploading} on:click={ResetResize}>Reset</button>
            </hbox>

            <br/>
            <canvas bind:this={canvasEl} />
            <hbox class="center">
                Preview width: <input type="text" class="num" bind:value={displayW}/>
                <button on:click={ResetCanvasResize}>Reset</button>
            </hbox>
            {:else}
                <!-- if it's not an image, there's nothing else to show -->
            {/if}
        {/if}

        <hr/>
        <hbox>
            <button on:click={()=>CloseModal(MODAL_CANCEL)} disabled={uploading}>Cancel</button>
            <filler/>
            <button on:click={DoUpload} disabled={!readyForUpload||uploading}>Upload</button>
        </hbox>
    </content>
</Modal>

<style>
content {
    min-width:600px;
}

canvas {
    width:100%;
    height:300;
    border:solid black 1px;
}

input.num {
    width:6ch;
    margin-left:3px;
    margin-right:3px;
    height:2.6ch;
}
</style>


