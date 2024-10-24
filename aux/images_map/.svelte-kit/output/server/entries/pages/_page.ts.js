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
  const q = encodeURIComponent(`
		PREFIX owl: <http://www.w3.org/2002/07/owl#>
		PREFIX rico: <https://www.ica.org/standards/RiC/ontology#>
		PREFIX bag: <http://bag.basisregistraties.overheid.nl/def/bag#>
		PREFIX schema: <https://schema.org/>
		PREFIX hg: <http://rdf.histograph.io/>
		PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
		PREFIX geo: <http://www.opengis.net/ont/geosparql#>
		PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
		PREFIX saa: <https://data.archief.amsterdam/ontology#>
		PREFIX memorix: <https://ams-migrate.memorix.io/resources/recordtypes/>
		PREFIX bif: <http://www.openlinksw.com/schemas/bif#>
		PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

		SELECT ?square (COUNT(DISTINCT ?resource) AS ?n_resources) WHERE {

		    ?resource a memorix:Image ;
			      rico:title ?title ;
			      <http://schema.org/thumbnailUrl> ?thumbnail ;
			      rico:creationDate ?creationDateItem ;
			      saa:hasOrHadSubjectAddress ?address . 
		    
		    ?creationDateItem rico:hasBeginningDate ?startDate .
		    ?creationDateItem rico:hasEndDate ?endDate .
		    ?creationDateItem rico:textualValue ?textDate .

		    FILTER(YEAR(?startDate) >= ?minYear)
		    FILTER(YEAR(?endDate) <= ?maxYear)
		  
		    ?address a hg:Address ;
			      schema:geoContains ?geo .
		  
		    ?geo a geo:Geometry ; 
			 geo:asWKT ?wkt .

		    VALUES (?square ?square_bbox) {
		    (<square:1> "POLYGON((4.8911476 52.4092260, 4.8080635 52.3403736, 4.9095154 52.3103678, 4.9711418 52.3806291, 4.8911476 52.4092260))")
		    (<square:2> "POLYGON((4.8954821 52.3742030, 4.9026918 52.3742816, 4.9026489 52.3709523, 4.8958254 52.3710047, 4.8954821 52.3742030))")
		    }
		  
		    BIND (bif:st_geomfromtext(xsd:string(?wkt)) as ?point_geometry)
		    BIND (bif:st_geomfromtext(?square_bbox) as ?bbox_geometry)
		    
		    FILTER (bif:st_intersects(?point_geometry, ?bbox_geometry)) 
		  

		  
		} GROUP BY ?square
	`);
  const url = "https://api.lod.uba.uva.nl/datasets/ATM/ATM-KG/services/ATM-KG/sparql?query=" + q;
  const images = await fetchApi(url, fetch2);
  return { images };
};
export {
  load
};
