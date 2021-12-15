<script context="module">
import { tick } from 'svelte';

let openModals = []; // stack of open modals: {.modal - modal comp, .resolve - Promise.resolve}
let holderEl = null; // DOM element into which new modals are appended

// global bit flags to pass to CloseModal, indicating how the modal is being closed; also used by
// optional close attribute to indicate what codes are allowed, e.g. <Modal close={MODAL_OK|MODAL_CANCEL} ...>
window.MODAL_OK = 1; // normal close
window.MODAL_ESCAPE = 2;
window.MODAL_OVERLAY = 4;
window.MODAL_CANCEL = 8;

// creates an instance of the given modal component and displays it over everything else.
// Returns a Promise that resolves like (closeCode, comp), where closeCode is one of the window.MODAL_*
// codes. If events is provided, it is a mapping of event names to handlers for events emitted by the
// modal component. Note that OpenModal/CloseModal are attached to the window object so that they are
// available globally and don't need to be imported.
window.OpenModal = function(comp, props, events={})
{
    // first make sure we have a place to put the modal
    if (!holderEl)
    {
        holderEl = document.createElement('div')
        document.body.appendChild(holderEl);
    }

    // we need to immediately push an entry onto the stack because the new modal's onMount will try to
    // write to it
    let entry = {};
    openModals.push(entry);

    let modal = new comp({target:holderEl, props});
    entry.modal = modal;
    for (let [eventName, cb] of Object.entries(events))
        modal.$on(eventName, cb);

    return new Promise((resolve, reject) => entry.resolve = resolve);
}

// attempts to close the top-most open modal. Typically the modal will close, but modals can override to
// prevent the user from dismissing a modal unless they make a choice.
window.CloseModal = async function(closeCode=MODAL_OK)
{
    if (!openModals.length)
        return;

    // special case, we allow CloseModal to be used in a button like <button on:click={CloseModal}> but in that case
    // we will be passed an event parameter, so detect that case
    if (closeCode instanceof PointerEvent)
        closeCode = MODAL_OK;

    // first see if closing is allowed via this code
    let entry = openModals[openModals.length-1];
    if (entry.close instanceof Function)
    {   // modal provided a callback function, and it is not letting us close
        if (!entry.close(closeCode))
            return;
    }
    else if (!(entry.close & closeCode))
    {   // modal provided a set of flags of allowed close codes, and this one isn't in there
        return;
    }

    openModals.pop(); // consume it
    entry.resolve({closeCode, comp:entry.modal});
    await tick(); // give the resolve a chance to run before we destroy the modal, otherwise the caller can't access any out props on the modal comp
    entry.modal.$destroy();
}

// modals can export a single-argument 'Update' function that can be called while the modal is
// open. This global API is how to call it without having a reference to the currently open modal.
// Returns the return value of the Update function, if any.
window.UpdateModal = function(args)
{
    if (!openModals.length)
        return;
    let modal = openModals[openModals.length-1].modal;
    if (!modal.Update || !(modal.Update instanceof Function))
    {
        console.log('ERROR: cannot update current modal');
        return
    }
    return modal.Update(args);
}

// ----------------------------------------------------------------------------------------------------------------
// firesite includes a few builtin modals; below are helpers for using them
// ----------------------------------------------------------------------------------------------------------------

// a "busy" modal - tells the user something is going on but doesn't let them cancel it. Optionally shows a progress bar.
// To change the message or change the progress bar amount over time, call e.g.UpdateModal({msg:'new msg', percent:90}).
import ModalBusy from './modal_busy.svelte';
window.OpenBusyModal = function(msg, showProgressBar)
{
    return OpenModal(ModalBusy, {message:msg, showProgressBar});
}

// a modal just used to tell the user a message. Has an Ok button so they can close it (escape is also allowed).
import ModalAlert from './modal_alert.svelte';
window.OpenAlertModal = function(msg, title='Notification')
{
    return OpenModal(ModalAlert, {msg, title});
}

// a modal for getting the user to confirm a scary action
import ModalConfirm from './modal_confirm.svelte';
window.OpenConfirmModal = function(msg, title='Confirm')
{
    return OpenModal(ModalConfirm, {msg, title});
}

</script>

<script>
import { onMount } from 'svelte';
export let close = MODAL_OK|MODAL_ESCAPE|MODAL_OVERLAY|MODAL_CANCEL; // if not specified, any action can close the modal

// store the close condition (i.e. the <Modal close={}> attribute value so CloseModal can check to see
// if a modal closing attempt should be allowed.
onMount(() =>
{
    openModals[openModals.length-1].close = close;
});

function Ignore() {}

function OnPositionerClicked(e)
{
    e.preventDefault();
    CloseModal(MODAL_OVERLAY);
}

function OnKeyDown(e)
{
    if (e.key == 'Escape')
        CloseModal(MODAL_ESCAPE);
}

</script>

<svelte:window on:keydown={OnKeyDown} />
<overlay>
    <positioner on:click|stopPropagation={OnPositionerClicked} on:contextmenu|stopPropagation={OnPositionerClicked}>
        <inputcatcher on:click|stopPropagation={Ignore} on:contextmenu|stopPropagation={Ignore}>
            <dialog>
                <slot></slot>
            </dialog>
        </inputcatcher>
    </positioner>
</overlay>

<style>
overlay {
    display:block;
    background-color:#00000020;  
    top:0; 
    left:0; 
    overflow:hidden; 
    position:fixed; 
    width:100%; 
    height:100%; 
    margin:0; 
    padding:0; 
    align-items: center; 
    justify-content: center;
    z-index: 1000;
}

positioner {
    justify-content: center;
    align-content: center;
    top: 50%;
    bottom: 50%;
    left: 50%;
    right: 50%;
    display: grid;
    height: 100%;
}

dialog {
    background: #fff;
    margin: 0 auto;
    width: auto;
    height: auto;
    display: flex;
    flex-direction: column;
    max-width: calc(100vw - 120px);
    max-height: calc(100vh - 60px);
    border: none;
    border-radius: 3px;
    box-shadow: 1px 1px 5px 0px rgba(0,0,0,0.5);
    padding: 5px;
    position: relative;
}

:global(dialog > h2, .dialog > h2) {
    background-color: #414141;
    color: #fff;
    font-size: 20px;
    font-weight: normal;
    height: 40px;
    line-height: 40px;
    padding: 0 12.5px;
    margin: 0;
    flex-grow: 0;
    flex-shrink: 0;
}

:global(dialog > content, .dialog > content) {
    overflow: auto;
    flex-grow: 1;
    flex-shrink: 1;
    padding: 15px;
    margin: auto;
    display: block;   
    width: 100%;    /* For when the dialog has fixed dimensions */
    height: 100%;
}

</style>
