import { writable } from 'svelte/store';

function createLoadingStore() {
  const { subscribe, update } = writable(false);
  let loadingCount = 0;

  return {
    subscribe,
    startLoading: () => {
      update(() => {
        loadingCount++;
        return true;
      });
    },
    stopLoading: () => {
      update(() => {
        loadingCount = Math.max(0, loadingCount - 1);
        return loadingCount > 0;
      });
    },
    reset: () => {
      update(() => {
        loadingCount = 0;
        return false;
      });
    }
  };
}

export const loadingStore = createLoadingStore();
