import { debounce } from 'lodash-es';
import { get, writable } from 'svelte/store';
import { inputStateStore } from './state';

// Store for the file handle and auto-save status
export const fileHandleStore = writable<FileSystemFileHandle | null>(null);
export const autoSaveStatusStore = writable<'idle' | 'saving' | 'saved' | 'error'>('idle');

// Function to set up auto-save for an opened file
export const setupAutoSave = (fileHandle: FileSystemFileHandle) => {
  fileHandleStore.set(fileHandle);
  autoSaveStatusStore.set('idle');
};

// Function to clear auto-save (when closing a file or opening a new one)
export const clearAutoSave = () => {
  fileHandleStore.set(null);
  autoSaveStatusStore.set('idle');
};

// Function to manually save to the current file handle
const saveToFileHandle = async (fileHandle: FileSystemFileHandle, content: string) => {
  try {
    autoSaveStatusStore.set('saving');
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
    autoSaveStatusStore.set('saved');

    // Reset to idle after 2 seconds
    setTimeout(() => {
      autoSaveStatusStore.set('idle');
    }, 2000);
  } catch (error) {
    console.error('Auto-save error:', error);
    autoSaveStatusStore.set('error');

    // Reset to idle after 3 seconds
    setTimeout(() => {
      autoSaveStatusStore.set('idle');
    }, 3000);
  }
};

// Debounced save function (saves 1 second after last change)
const debouncedSave = debounce((fileHandle: FileSystemFileHandle, code: string) => {
  void saveToFileHandle(fileHandle, code);
}, 1000);

// Initialize auto-save listener
export const initAutoSave = () => {
  inputStateStore.subscribe((state) => {
    const fileHandle = get(fileHandleStore);
    if (fileHandle && state.code) {
      debouncedSave(fileHandle, state.code);
    }
  });
};

// Function to open a file and set up auto-save
export const openFileWithAutoSave = async (): Promise<string | null> => {
  try {
    // @ts-ignore - showOpenFilePicker may not exist in all browsers
    const [fileHandle] = await window.showOpenFilePicker({
      types: [
        {
          description: 'Mermaid Files',
          accept: { 'text/plain': ['.mmd', '.txt'] }
        }
      ],
      multiple: false
    });

    const file = await fileHandle.getFile();
    const content = await file.text();

    // Set up auto-save for this file
    setupAutoSave(fileHandle);

    return content;
  } catch (error: any) {
    console.error('File open error:', error);
    // User cancelled or API not supported
    const name = error && (error.name || error.constructor?.name);
    if (name === 'AbortError' || name === 'NotAllowedError') {
      return null; // user cancelled
    }
    throw error;
  }
};
