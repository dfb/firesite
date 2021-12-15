<script>
// A modal used to inform the user of something. Just has a message and an ok button.
import Modal from './modal.svelte';

export let msg = 'Something happened.';
export let title = 'Notification';

</script>

<Modal close={MODAL_OK|MODAL_ESCAPE}>
    <h2>{title || 'Notification'}</h2>
    <content>
        <p>{msg}</p>
        <hr/>
        <button on:click={CloseModal}>Ok</button>
    </content>
</Modal>

