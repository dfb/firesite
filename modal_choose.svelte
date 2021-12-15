<svelte:options accessors/>
<script>
// Simple modal dialog that presents the user with some options.
//
// Also used for the busy dialog (where the user can't close the dialog until an async operation is done.
// In this scenario, use the UpdateModal(msg) function to give progress updates and call CloseModal when the operation
// is complete.
import Modal from './firesite/modal.svelte';

// text to show the user above the buttons
export let text = 'Proceed with this action?';

// list of buttons and value to send to the callback when clicked
// each must have at least a .label member
export let buttons = [{label:'Ok'}, {label:'Cancel'}];

export let allowCancel = true;

// returned to the caller
export let choice = null;

// used during async operations to give progress updates - called by UpdateModal
export function Update(newMsg)
{
    text = newMsg;
}

function Go(value)
{
    choice = value;
    CloseModal(MODAL_OK);
}

function OnClose(withCode)
{
    return allowCancel || withCode == MODAL_OK;
}

</script>

<Modal close={OnClose}>
    <h2>Stuff</h2>
    <content>
        <p>{@html text}</p>
        <hbox>
            {#each buttons as b, i}
            <button class="{b.label == 'Cancel' ? 'red' : 'blue'}" on:click="{() => Go(b)}">{b.label}</button>
            {/each}
        </hbox>
    </content>
</Modal>

