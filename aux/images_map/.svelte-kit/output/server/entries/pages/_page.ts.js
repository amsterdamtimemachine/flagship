import { w as writable, e as error } from "../../chunks/index.js";
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
const loadingStore = createLoadingStore();
async function fetchApi(endpoint, fetchFn = fetch) {
  loadingStore.startLoading();
  try {
    const response = await fetchFn(endpoint);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "An unknown error occurred";
    error(500, { message: errorMessage, code: "API_ERROR" });
  } finally {
    loadingStore.stopLoading();
  }
}
const load = async ({ fetch: fetch2 }) => {
  return {
    images: await fetchApi(`https://api.lod.uba.uva.nl/queries/LeonvanWissen/SAA-Beeldbank/5/run?`, fetch2)
  };
};
export {
  load
};
