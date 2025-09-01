// UI-related types for consistent interface across components

import type { Component } from 'svelte';

export interface PhosphorIconProps {
  size?: number;
  weight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone';
  color?: string;
  mirrored?: boolean;
  [key: `data-${string}`]: any; 
}

// Phosphor icon component type
export type PhosphorIcon = Component<PhosphorIconProps, {}, "">;
