<script lang="ts">
    import MapGLGrid from '$components/MapGLGrid.svelte';
    
    let showModal = false;
    let modalData = {
        id: '',
        coordinates: [] as number[][],
        position: { x: 0, y: 0 }
    };

    function handleCellHover(event: CustomEvent) {
        const { id, coordinates, mouseX, mouseY } = event.detail;
        
        showModal = true;
        modalData = {
            id,
            coordinates,
            position: { x: mouseX, y: mouseY }
        };
    }

    function handleCellLeave() {
        showModal = false;
    }

    function handleCellClick(event: CustomEvent) {
        const { id, coordinates } = event.detail;
        console.log('Cell clicked:', id, coordinates);
    }
</script>

<div class="relative">
    <MapGLGrid
        on:cellHover={handleCellHover}
        on:cellLeave={handleCellLeave}
        on:cellClick={handleCellClick}
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
                Coordinates: {JSON.stringify(modalData.coordinates[0])}
            </p>
        </div>
    {/if}
</div>
