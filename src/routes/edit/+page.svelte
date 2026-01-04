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
  import Select from '$/components/ui/select';
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
  import FolderOpenIcon from '~icons/material-symbols/folder-open';
  import { onMount } from 'svelte';
  import { openFileWithAutoSave, initAutoSave, autoSaveStatusStore, fileHandleStore, clearAutoSave } from '$/util/autoSave';
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
    // Initialize auto-save functionality
    initAutoSave();
  });

  let isSaving = false;

  const downloadMmd = async (event?: Event) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (isSaving) return;
    isSaving = true;
    try {
      const state = get(inputStateStore);
      const code = state?.code ?? '';
      const baseName = `mermaid-diagram-${new Date().toISOString().replace(/[:.]/g, '-')}`;

      if (saveFormat === 'mmd') {
        const filename = `${baseName}.mmd`;
        const blob = new Blob([code], { type: 'text/plain' });
        await saveBlob(blob, filename);
        return;
      }

      // Try server-side render first for the selected raster format (png/pdf)
      const desiredFormat = saveFormat === 'pdf' ? 'pdf' : 'png';
      try {
        const resp = await fetch('/api/render', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, scale: 2, format: desiredFormat })
        });
        if (resp.ok) {
          const blob = await resp.blob();
          const filename = `${baseName}.${desiredFormat}`;
          await saveBlob(blob, filename);
          return;
        }
      } catch (e) {
        console.debug('Server render failed, falling back to client rasterization', e);
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
      if (saveFormat === 'pdf') {
        // Fallback for PDF: open image in new tab and trigger print (user can Save as PDF)
        const imgUrl = dataUrl;
        const filename = `${baseName}.pdf`;
        const newTab = window.open('', '_blank');
        if (newTab) {
          const html = `<!doctype html><html><head><title>${filename}</title></head><body style="margin:0"><img src="${imgUrl}" style="width:100%;height:auto;display:block" onload="setTimeout(()=>window.print(),100)"></body></html>`;
          newTab.document.open();
          newTab.document.write(html);
          newTab.document.close();
          return;
        }
        // If new tab blocked, fall back to saving PNG
      }
      await saveBlob(blob, `${baseName}.png`);
    } finally {
      isSaving = false;
    }
  };

  // Save blob to user-chosen location if possible (File System Access API), otherwise fallback to anchor download
  async function saveBlob(blob: Blob, filename: string) {
    // @ts-ignore - showSaveFilePicker may not exist in all browsers
    const hasFilePicker = typeof window !== 'undefined' && 'showSaveFilePicker' in window;
    const ext = filename.split('.').pop()?.toLowerCase() ?? '';
    let types: any[];
    if (ext === 'mmd') {
      types = [
        {
          description: 'Mermaid (.mmd)',
          accept: { 'text/plain': ['.mmd'] }
        }
      ];
    } else if (ext === 'png') {
      types = [
        {
          description: 'PNG Image',
          accept: { 'image/png': ['.png'] }
        }
      ];
    } else if (ext === 'pdf') {
      types = [
        {
          description: 'PDF Document',
          accept: { 'application/pdf': ['.pdf'] }
        }
      ];
    } else {
      types = [
        {
          description: 'File',
          accept: { '*/*': ['.*'] }
        }
      ];
    }

    if (hasFilePicker) {
      try {
        // @ts-ignore
        const handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types
        });
        // @ts-ignore
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return;
      } catch (err: any) {
        // user probably cancelled or API threw — log for diagnostics
        console.debug('showSaveFilePicker failed or cancelled, falling back', err);
        // If the user explicitly cancelled the picker, don't run fallback flows.
        // Common names: 'AbortError', 'NotAllowedError'
        const name = err && (err.name || err.constructor?.name);
        if (name === 'AbortError' || name === 'NotAllowedError') {
          return; // user cancelled — stop here
        }
        // continue to fallback methods below for other errors
      }
    }

    // Fallback 1: force a download with an anchor (preferred to opening preview in a new tab)
    try {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      // Some browsers need the link in the document to work
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      return;
    } catch (err) {
      console.debug('Anchor download failed, falling back to open in new tab', err);
    }

    // Fallback 2: open in new tab so user can Save As (Ctrl/Cmd+S) and choose location
    try {
      const url = URL.createObjectURL(blob);
      const newTab = window.open(url, '_blank');
      if (newTab) {
        try {
          newTab.document.title = filename;
        } catch {
          // ignore cross-origin or blocked access
        }
        console.info('Opened file in new tab. Use Save As (Ctrl/Cmd+S) to choose location and filename.');
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        return;
      }
    } catch (err) {
      console.debug('Opening new tab failed', err);
    }

    // Last resort: notify user
    alert('Unable to save file automatically. Please copy the content or try a different browser.');
  }

  let isHistoryOpen = $state(false);
  let saveFormat = $state('mmd');
  
  // Open file handler
  const openFile = async () => {
    try {
      const content = await openFileWithAutoSave();
      if (content !== null) {
        updateCodeStore({ code: content, updateDiagram: true });
        logEvent('fileOpened');
      }
    } catch (error) {
      console.error('Failed to open file:', error);
      alert('Failed to open file. File System Access API may not be supported in your browser.');
    }
  };

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

  <Navbar mobileToggle={isMobile ? mobileToggle : undefined}><div class="flex gap-2">
    <Toggle bind:pressed={isHistoryOpen} size="sm">
      <HistoryIcon />
    </Toggle>
    <Share />
    
    <div class="flex items-center gap-1 rounded border border-border bg-muted px-2 py-1 text-xs whitespace-nowrap">
      {#if $fileHandleStore}
        {#if $autoSaveStatusStore === 'saving'}
          <span class="text-muted-foreground">Auto-saving...</span>
        {:else if $autoSaveStatusStore === 'saved'}
          <span class="text-green-600 dark:text-green-400">✓ Saved</span>
        {:else if $autoSaveStatusStore === 'error'}
          <span class="text-red-600 dark:text-red-400">⚠ Save failed</span>
        {:else}
          <span class="text-muted-foreground">Auto-save: On</span>
        {/if}
        <button
          onclick={() => clearAutoSave()}
          class="ml-1 text-muted-foreground hover:text-foreground"
          title="Disable auto-save">
          ×
        </button>
      {:else}
        <span class="text-muted-foreground text-gray-400">Auto-save: Off</span>
      {/if}
    </div>
    
    <Button
      variant="outline"
      size="sm"
      onclick={openFile}
      title="Open .mmd file">
      <FolderOpenIcon />
      Open
    </Button>
      
        <Select
          aria-label="Save format"
          size="sm"
          className="border"
          bind:value={saveFormat}
          disabled={isSaving}>
          <option value="mmd">Mermaid</option>
          <option value="pdf">PDF</option>
          <option value="png">PNG</option>
        </Select>
        <Button 
          variant="accent" 
          size="sm" 
          onclick={downloadMmd}
          disabled={isSaving}>
          <DownloadIcon />
          {#if isSaving}Saving...{:else}Save{/if}
        </Button>
      </div>
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
