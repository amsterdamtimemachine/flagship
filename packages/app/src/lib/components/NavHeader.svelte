<script lang="ts">
	import { mergeCss } from '$utils/utils';

	interface Props {
		class?: string;
	}

	let { class: className }: Props = $props();
</script>

<nav>
	<h1> Amsterdam Time Machine </h1>
	<button>Information </button>
</nav>
