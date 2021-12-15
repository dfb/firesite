<script>
// a modal for getting the user to confirm a scary action
import Modal from './modal.svelte';

export let msg = 'Are you sure you want to do this?';
export let title = 'Please confirm';

</script>

<Modal close={MODAL_OK|MODAL_CANCEL|MODAL_ESCAPE}>
    <h2>{title}</h2>
    <content>
        <p>{msg}</p>
        <hr/>
        <button on:click={()=>CloseModal(MODAL_CANCEL)}>Cancel</button>
        <button on:click={()=>CloseModal(MODAL_OK)}>Ok</button>
    </content>
</Modal>

