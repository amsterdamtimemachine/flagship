import type { ClassValue } from 'clsx';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { HeatmapBlueprintCell, HeatmapDimensions } from '@atm/shared/types';

export function mergeCss(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function formatDate(date: string, separator: string = '-'): string {
	// expects date in the form of "number_number" eg "1945_2000"
	let [start, end] = date.split('_');
	return `${start}${separator}${end}`;
}

export function pickAndConvertObjectToArray<T extends Record<string, unknown>>(
	obj: T,
	keys: (keyof T)[]
): [string, unknown][] {
	return keys.map((key) => [key.toString(), obj[key]]);
}

export function prettifyKey(key: string): string {
	// Replace underscores with spaces
	const withSpaces = key.replace(/_/g, ' ');

	// Capitalize the first letter and convert rest to lowercase
	return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1).toLowerCase();
}

/**
 * Validates if a cell ID exists in the heatmap blueprint and is properly formatted
 */
export function validateCellId(
	cellId: string,
	heatmapBlueprint: HeatmapBlueprintCell[],
	dimensions: HeatmapDimensions
): { isValid: boolean; error?: string } {
	// Check basic format (row_col pattern)
	const cellPattern = /^\d+_\d+$/;
	if (!cellPattern.test(cellId)) {
		return {
			isValid: false,
			error: `Invalid cell format. Expected "row_col" format, got "${cellId}"`
		};
	}

	const [rowStr, colStr] = cellId.split('_');
	const row = parseInt(rowStr, 10);
	const col = parseInt(colStr, 10);

	// Check if coordinates are within grid bounds
	if (row < 0 || row >= dimensions.rowsAmount || col < 0 || col >= dimensions.colsAmount) {
		return {
			isValid: false,
			error: `Cell "${cellId}" is outside grid bounds (${dimensions.rowsAmount}x${dimensions.colsAmount})`
		};
	}

	// Check if cell actually exists in blueprint
	const cellExists = heatmapBlueprint.some((cell) => cell.cellId === cellId);
	if (!cellExists) {
		return {
			isValid: false,
			error: `Cell "${cellId}" not found in heatmap data`
		};
	}

	return { isValid: true };
}
