<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  export let value: string | number | undefined;
  export let disabled = false;
  export let className = '';
  export let size: 'default' | 'sm' | 'lg' = 'default';
  const dispatch = createEventDispatcher();

  function handleChange(e: Event) {
    // @ts-ignore
    value = e.target.value;
    dispatch('change', e);
  }
</script>

<select
  class={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none disabled:opacity-50 ${
    size === 'sm' ? 'h-8 px-3 text-xs' : size === 'lg' ? 'h-10 rounded-md px-8' : 'h-9 px-4 py-2 text-sm'
  } ${className} border shadow-sm bg-background`}
  {disabled}
  bind:value
  on:change={handleChange}
  {...$$restProps}>
  <slot />
</select>
