<script lang="ts">
    import type { GeoFeature } from '@atm/shared-types'; 
    export let feature: GeoFeature;
</script>
<div>
   <div class="block" > 
    <span>{feature?.properties.start_date}</span> -  <span> {feature?.properties.end_date} </span> 
   </div>
   <a href="{feature?.properties.url}"> {feature?.properties.url} </a> 
   <a href="{feature?.properties.thumb}"> {feature?.properties.thumb} </a> 
</div>


