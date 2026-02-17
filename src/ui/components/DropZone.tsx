/**
 * Drag-and-drop file upload zone component.
 *
 * Provides visual feedback during drag operations and handles file drops.
 *
 * Complexity: O(1) for rendering and event handling.
 */

import { h, VNode, ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';

export interface DropZoneProps {
  accept: string[]; // File extensions (e.g., ['.csv', '.json'])
  onDrop: (file: File) => void;
  disabled?: boolean;
  children?: ComponentChildren;
  className?: string;
}

export function DropZone(props: DropZoneProps): VNode {
  const { accept, onDrop, disabled = false, children, className = '' } = props;
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragCounter, setDragCounter] = useState<number>(0);

  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (disabled) return;

    setDragCounter(prev => prev + 1);
    if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (disabled) return;

    setDragCounter(prev => {
      const next = prev - 1;
      if (next === 0) {
        setIsDragging(false);
      }
      return next;
    });
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (disabled) return;

    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (disabled) return;

    setIsDragging(false);
    setDragCounter(0);

    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;

    const file = files[0]; // Only handle first file

    // Check file extension
    const fileExtension = file.name.toLowerCase().match(/\.[^.]+$/)?.[0];
    if (fileExtension && accept.includes(fileExtension)) {
      onDrop(file);
    } else {
      alert(`Invalid file type. Please upload one of: ${accept.join(', ')}`);
    }
  };

  const handleClick = () => {
    if (disabled) return;

    // Create hidden file input and trigger click
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept.join(',');
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        onDrop(files[0]);
      }
    };
    input.click();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (disabled) return;

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div
      class={`wl-dropZone ${isDragging ? 'wl-dropZoneActive' : ''} ${disabled ? 'wl-dropZoneDisabled' : ''} ${className}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={disabled ? -1 : 0}
      role="button"
      aria-label="Drop file here or click to upload"
    >
      {isDragging ? (
        <div class="wl-dropZoneOverlay">
          <div class="wl-dropZoneOverlayText">
            📁 Drop file here
          </div>
        </div>
      ) : null}
      {children}
    </div>
  );
}
