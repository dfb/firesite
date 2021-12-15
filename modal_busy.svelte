<script>
// An uncancelable modal to show the user when something is happening and they need to wait.
// Updateable and optional shows a progress bar.
import Modal from './modal.svelte';

export let showProgressBar = false; // if true, show a progress bar
export let message = 'Please wait...';

let percentDone = 0;
export function Update({msg, percent})
{
    if (msg != null)
        message = msg;
    if (percent != null)
        percentDone = percent;
}

</script>

<Modal close={MODAL_OK}>
    <h2>Please wait</h2>
    <content>
        {#if showProgressBar}
            <span class="progressBarHolder">
                <span class="progressBar" style="width:{percentDone}%"></span>
            </span>

        {/if}
        <p>{message}</p>
    </content>
</Modal>

<style>
span.progressBarHolder {
    border:solid #88888888 1px;
    margin:10px;
    width:400px;
    height:25px;
    padding:0px;
    display:inline-block;
}

span.progressBar {
    display:inline-block;
    margin:0px;
    padding:0px;
    background-color:#99dd99;
    height:100%;
}
</style>
