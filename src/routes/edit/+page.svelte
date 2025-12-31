<script lang="ts">
  import Actions from '$/components/Actions.svelte';
  import Card from '$/components/Card/Card.svelte';
  import DiagramDocButton from '$/components/DiagramDocumentationButton.svelte';
  import Editor from '$/components/Editor.svelte';
  import History from '$/components/History/History.svelte';
  import McWrapper from '$/components/McWrapper.svelte';
  import MermaidChartIcon from '$/components/MermaidChartIcon.svelte';
  import Navbar from '$/components/Navbar.svelte';
  import PanZoomToolbar from '$/components/PanZoomToolbar.svelte';
  import Preset from '$/components/Preset.svelte';
  import Share from '$/components/Share.svelte';
  import SyncRoughToolbar from '$/components/SyncRoughToolbar.svelte';
  import { Button } from '$/components/ui/button';
  import * as Resizable from '$/components/ui/resizable';
  import { Switch } from '$/components/ui/switch';
  import { Toggle } from '$/components/ui/toggle';
  import VersionSecurityToolbar from '$/components/VersionSecurityToolbar.svelte';
  import View from '$/components/View.svelte';
  import type { EditorMode, Tab } from '$/types';
  import { PanZoomState } from '$/util/panZoom';
  import { stateStore, updateCodeStore, urlsStore } from '$/util/state';
  import { logEvent } from '$/util/stats';
  import { initHandler } from '$/util/util';
  import { inputStateStore } from '$/util/state';
  import { env } from '$/util/env';
  import { get } from 'svelte/store';
  import DownloadIcon from '~icons/material-symbols/download';
  import { onMount } from 'svelte';
  import CodeIcon from '~icons/custom/code';
  import HistoryIcon from '~icons/material-symbols/history';
  import GearIcon from '~icons/material-symbols/settings-outline-rounded';

  const panZoomState = new PanZoomState();

  const tabSelectHandler = (tab: Tab) => {
    const editorMode: EditorMode = tab.id === 'code' ? 'code' : 'config';
    updateCodeStore({ editorMode });
  };

  const editorTabs: Tab[] = [
    {
      icon: CodeIcon,
      id: 'code',
      title: 'Code'
    },
    {
      icon: GearIcon,
      id: 'config',
      title: 'Config'
    }
  ];

  let width = $state(0);
  let isMobile = $derived(width < 640);
  let isViewMode = $state(true);

  onMount(async () => {
    await initHandler();
    window.addEventListener('appinstalled', () => {
      logEvent('pwaInstalled', { isMobile });
    });
  });

  const downloadMmd = async (event?: Event) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    const state = get(inputStateStore);
    const code = state?.code ?? '';
      const filename = `mermaid-diagram-${new Date().toISOString().replace(/[:.]/g, '-')}.mmd`;
      // Optionally: send source to server for higher-quality rendering via mermaid-cli
      // If server endpoint exists, prefer it to produce better PNGs
      try {
        const state = get(inputStateStore);
        const code = state?.code ?? '';
        const resp = await fetch('/api/render', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, scale: 2, format: 'png' })
        });
        if (resp.ok) {
          const blob = await resp.blob();
          const filename = `mermaid-diagram-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
          const url = URL.createObjectURL(blob);

          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          setTimeout(() => URL.revokeObjectURL(url), 2000);
          
          return; // <--- ADD THIS: Stop the function here so the fallback doesn't run!
        }
      } catch (e) {
        // server not available or failed — fall back to client-side rasterization
        console.debug('Server render failed, falling back to client PNG', e);
      }
    // Fallback: client-side rasterization of current SVG to PNG
    const svg = document.querySelector<SVGElement>('#container svg');
    if (!svg) {
      alert('Diagram SVG not found');
      return;
    }
    const clone = svg.cloneNode(true) as SVGElement;
    const box = svg.getBoundingClientRect();
    const multiplier = 2;
    const width = Math.max(1, Math.round(box.width * multiplier));
    const height = Math.max(1, Math.round(box.height * multiplier));
    clone.setAttribute('width', `${width}`);
    clone.setAttribute('height', `${height}`);
    clone.style.backgroundColor = window.getComputedStyle(document.body).getPropertyValue('--background');

    const svgString = `<?xml version="1.0" encoding="UTF-8"?>\n${clone.outerHTML}`;
    const svgBase64 = window.btoa(unescape(encodeURIComponent(svgString)));
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = (e) => reject(e);
      img.src = `data:image/svg+xml;base64,${svgBase64}`;
    }).catch((e) => {
      console.error('Client rasterization failed', e);
      alert('Failed to create PNG');
      return;
    });
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      alert('Cannot get canvas context');
      return;
    }
    ctx.fillStyle = window.getComputedStyle(document.body).getPropertyValue('--background');
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/png');
    // Convert dataUrl to blob and prompt save
    const blob = await (await fetch(dataUrl)).blob();
    await saveBlob(blob, filename.replace(/\.mmd$/, '.png'));
  };

  // Save blob to user-chosen location if possible (File System Access API), otherwise fallback to anchor download
  async function saveBlob(blob: Blob, filename: string) {
    // @ts-ignore - showSaveFilePicker may not exist in all browsers
    const hasFilePicker = typeof window !== 'undefined' && 'showSaveFilePicker' in window;
    if (hasFilePicker) {
      try {
        // @ts-ignore
        const handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [
            {
              description: 'PNG Image',
              accept: { 'image/png': ['.png'] }
            }
          ]
        });
        // @ts-ignore
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return;
      } catch (err) {
        // user probably cancelled or API threw — fallback to anchor
        console.debug('showSaveFilePicker failed or cancelled, falling back', err);
      }
    }

    // Fallback: open in new tab so user can Save As (Ctrl/Cmd+S) and choose location
    const url = URL.createObjectURL(blob);
    const newTab = window.open(url, '_blank');
    if (newTab) {
      try {
        newTab.document.title = filename;
      } catch {
        // ignore cross-origin or blocked access
      }
      // Inform user they can use Save As to choose location
      // Use a brief non-blocking alert (console + small on-page hint could be added later)
      console.info('Opened image in new tab. Use Save As (Ctrl/Cmd+S) to choose location and filename.');
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      return;
    }

    // If popup blocked, fall back to direct download
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  let isHistoryOpen = $state(false);

  let editorPane: Resizable.Pane | undefined;
  $effect(() => {
    if (isMobile) {
      editorPane?.resize(50);
    }
  });
</script>

<div class="flex h-full flex-col overflow-hidden">
  {#snippet mobileToggle()}
    <div class="flex items-center gap-2">
      Edit <Switch
        id="editorMode"
        class="data-[state=checked]:bg-accent"
        bind:checked={isViewMode}
        onclick={() => {
          logEvent('mobileViewToggle');
        }} /> View
    </div>
  {/snippet}

  <Navbar mobileToggle={isMobile ? mobileToggle : undefined}>
    <Toggle bind:pressed={isHistoryOpen} size="sm">
      <HistoryIcon />
    </Toggle>
    <Share />
      <McWrapper>
        <Button 
          variant="accent" 
          size="sm" 
          onclick={downloadMmd}>
          <DownloadIcon />
          Save diagram
        </Button>
      </McWrapper>
  </Navbar>

  <div class="flex flex-1 flex-col overflow-hidden" bind:clientWidth={width}>
    <div
      class={[
        'size-full',
        isMobile && ['w-[200%] duration-300', isViewMode && '-translate-x-1/2']
      ]}>
      <Resizable.PaneGroup
        direction="horizontal"
        autoSaveId="liveEditor"
        class="gap-4 p-2 pt-0 sm:gap-0 sm:p-6 sm:pt-0">
        <Resizable.Pane bind:this={editorPane} defaultSize={30} minSize={15}>
          <div class="flex h-full flex-col gap-4 sm:gap-6">
            <Card
              onselect={tabSelectHandler}
              isOpen
              tabs={editorTabs}
              activeTabID={$stateStore.editorMode}
              isClosable={false}>
              {#snippet actions()}
                <DiagramDocButton />
              {/snippet}
              <Editor {isMobile} />
            </Card>

            <div class="group flex flex-wrap justify-between gap-4 sm:gap-6">
              <Preset />
              <Actions />
            </div>
          </div>
        </Resizable.Pane>
        <Resizable.Handle class="mr-1 hidden opacity-0 sm:block" />
        <Resizable.Pane minSize={15} class="relative flex h-full flex-1 flex-col overflow-hidden">
          <View {panZoomState} shouldShowGrid={$stateStore.grid} />
          <div class="absolute top-0 right-0"><PanZoomToolbar {panZoomState} /></div>
          <div class="absolute right-0 bottom-0"><VersionSecurityToolbar /></div>
          <div class="absolute bottom-0 left-0 sm:left-5"><SyncRoughToolbar /></div>
        </Resizable.Pane>
        {#if isHistoryOpen}
          <Resizable.Handle class="ml-1 hidden opacity-0 sm:block" />
          <Resizable.Pane
            minSize={15}
            defaultSize={30}
            class="hidden h-full flex-grow flex-col sm:flex">
            <History />
          </Resizable.Pane>
        {/if}
      </Resizable.PaneGroup>
    </div>
  </div>
</div>
