function createLoadingState() {
	let isLoading = $state(false);
	let loadingCount = 0;

	return {
		get isLoading() {
			return isLoading;
		},
		startLoading: () => {
			loadingCount++;
			isLoading = true;
		},
		stopLoading: () => {
			loadingCount = Math.max(0, loadingCount - 1);
			isLoading = loadingCount > 0;
		},
		reset: () => {
			loadingCount = 0;
			isLoading = false;
		}
	};
}

export const loadingState = createLoadingState();
