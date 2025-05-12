<script lang="ts">
 import { mergeCss } from '$utils'
  export let id: string = "";                
  export let name: string = "";              
  export let value: string = "";             
  export let type: "text" | "search" | "email" | "password" | "tel" | "url" | "number" | "date" | "time" | "datetime-local" | "month" | "week" | "color" = "search";  
  export let placeholder: string = "";       
  export let required: boolean = false;      
  export let disabled: boolean = false;      
  export let readonly: boolean = false;      
  export let autocomplete: string = "on";    
  export let minlength: number | null = null;
  export let maxlength: number | null = null;
  export let pattern: string | null = null;  
  export let size: number | null = null;     
  export let errorMessage: string = "";      
  export let inputClass: string = "";        
  export let ariaDescribedby: string = "";   
  export let ariaInvalid: boolean = false;   
  
  let className: string | undefined = undefined;
  export { className as class };

  // Handle form validation state
  $: invalid: boolean = errorMessage !== "";
  $: ariaInvalid = invalid || ariaInvalid;
  $: describedByIds: string = [ariaDescribedby, invalid ? `${id}-error` : null]
    .filter(Boolean)
    .join(' ');
    
  // Tailwind classes for the input
  $: baseInputClasses: string = "w-full px-3 py-2 border rounded-md text-base focus:outline-none focus:ring-2 transition-colors";
  $: stateInputClasses: string = invalid 
    ? "border-red-500 focus:border-red-500 focus:ring-red-200" 
    : "border-gray-300 focus:border-blue-500 focus:ring-blue-200";
  $: disabledInputClasses: string = disabled ? "bg-gray-100 text-gray-500 cursor-not-allowed" : "";
  $: finalInputClasses: string = `${baseInputClasses} ${stateInputClasses} ${disabledInputClasses} ${inputClass}`;
</script>

<div class={`mb-4 ${className || ''}`}>
  <input
    {id}
    {name}
    {type}
    bind:value
    {placeholder}
    {disabled}
    {readonly}
    {required}
    autocomplete={autocomplete}
    aria-invalid={ariaInvalid}
    aria-required={required}
    aria-describedby={describedByIds || undefined}
    class={finalInputClasses}
    {pattern}
    {size}
    min={type === 'number' ? minlength : undefined}
    max={type === 'number' ? maxlength : undefined}
    minlength={type !== 'number' ? minlength : undefined}
    maxlength={type !== 'number' ? maxlength : undefined}
    on:input
    on:change
    on:focus
    on:blur
    on:keydown
    on:keyup
    on:keypress
    {...$$restProps}/>
  
  {#if errorMessage}
    <div class="mt-1 text-sm text-red-600" id="{id}-error" aria-live="polite">
      {errorMessage}
    </div>
  {/if}
</div>
