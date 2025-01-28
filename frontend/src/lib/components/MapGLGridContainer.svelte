<script lang="ts">
    import {goto} from '$app/navigation';
    import {mergeCss} from '$utils/utils';
    let className : string | undefined = undefined;
    export {className as class}

    const baseUrl = 'cells' 

    interface ModalData {
        id: string;
        coordinates: number[][];  // Array of [longitude, latitude] pairs
        position: { x: number; y: number };
        value?: number;
        count?: number;
    }

    let showModal = false;
    let modalData: ModalData = {
        id: '',
        coordinates: [],
        position: { x: 0, y: 0 }
    };

    function handleCellHover(event: CustomEvent) {
        const { id, coordinates, mouseX, mouseY, value, count } = event.detail;
        showModal = true;
        modalData = {
            id,
            coordinates,
            position: { x: mouseX, y: mouseY },
            value,
            count
        };
    }

    function handleCellLeave() {
        showModal = false;
    }

    function handleCellClick(event: CustomEvent) {
        const { id, period } = event.detail;
        goto(`${baseUrl}/${period}/${id}`);
    }
</script>

<div class={mergeCss('', className)}>
    <slot 
        {handleCellHover}
        {handleCellLeave}
        {handleCellClick}
    />
    
    {#if showModal}
        <div
            class="absolute pointer-events-none bg-white rounded-lg shadow-lg p-4 z-50 transition-opacity duration-150"
            style="left: {modalData.position.x + 10}px; top: {modalData.position.y + 10}px"
        >
            <p class="text-sm">
                ID: {modalData.id}
                <br>
                {#if modalData.count !== undefined}
                    Count: {modalData.count}
                    <br>
                {/if}
                {#if modalData.value !== undefined}
                    Intensity: {(modalData.value * 100).toFixed(1)}%
                    <br>
                {/if}
            </p>
        </div>
    {/if}
</div>
