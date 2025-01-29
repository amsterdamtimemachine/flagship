import type { ClassValue } from 'clsx';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
export function mergeCss(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function formatDate(date: string, separator: string = '-') {
	// expects date in the form of "number_number" eg "1945_2000"
	let [start, end] = date.split('_');
	return `${start}${separator}${end}`;
}
