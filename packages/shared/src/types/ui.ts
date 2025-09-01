// UI-related types for consistent interface across components

import type { Component } from 'svelte';

// Phosphor icon props based on their official API
export interface PhosphorIconProps {
  size?: number;
  weight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone';
  color?: string;
  mirrored?: boolean;
  [key: `data-${string}`]: any; // Support data attributes
}

// Phosphor icon component type
export type PhosphorIcon = Component<PhosphorIconProps, {}, "">;