<script lang="ts" module>
	import { Toaster } from 'melt/builders';
	
	type ToastData = {
		title: string;
		description: string;
		type?: 'success' | 'error' | 'warning' | 'info';
	};
	
	const toaster = new Toaster<ToastData>({
		closeDelay: 5000,
		hover: 'pause'
	});
	
	export const addToast = toaster.addToast;
</script>

<script lang="ts">
	import { fade } from 'svelte/transition';
</script>

<div {...toaster.root} class="">
	{#each toaster.toasts.slice().reverse() as toast, index (toast.id)}
		<div 
			{...toast.content}
			in:fade={{ duration: 300 }}
			out:fade={{ duration: 200 }}
			class="p-2 rounded-xs shadow-lg border max-w-sm bg-white fixed right-6 z-50"
			class:border-red-200={toast.data.type === 'error'}
			class:border-yellow-200={toast.data.type === 'warning'}
			class:border-green-200={toast.data.type === 'success'}
			class:border-blue-200={toast.data.type === 'info'}
			style="bottom: {24 + (index * 90)}px; box-shadow: -1px 1px 31px -7px rgba(0,0,0,0.58);"
		>
			<div class="flex justify-between items-start">
				<div>
					<h3 {...toast.title} class="font-sans font-semibold text-sm mb-1">{toast.data.title}</h3>
					<div {...toast.description} class="font-sans text-sm text-gray-600">{toast.data.description}</div>
				</div>
				<button 
					{...toast.close} 
					aria-label="dismiss alert"
					class="ml-2 text-gray-400 hover:text-gray-600"
				>
					×
				</button>
			</div>
		</div>
	{/each}
</div>
