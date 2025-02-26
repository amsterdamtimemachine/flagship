import type { ClassValue } from 'clsx';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
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
  return keys.map(key => [key.toString(), obj[key]]);
}


export function prettifyKey(key: string): string{
  // Replace underscores with spaces
  const withSpaces = key.replace(/_/g, ' ');
  
  // Capitalize the first letter and convert rest to lowercase
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1).toLowerCase();
}
