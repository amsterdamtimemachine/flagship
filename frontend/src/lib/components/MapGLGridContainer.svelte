<script lang="ts">
    import {goto} from '$app/navigation';

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
        //console.log('Cell clicked:', { id, period });
    }
</script>

<div class="relative w-full h-full">
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
            <h3 class="font-bold text-sm">Cell Info</h3>
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
                Coordinates: {modalData.coordinates[0] ? modalData.coordinates[0].map(coord => `${coord[0].toFixed(4)}, ${coord[1].toFixed(4)}`).join(' | ') : ''}
            </p>
        </div>
    {/if}
</div>
