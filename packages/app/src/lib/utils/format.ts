export function formatDate(date: string, separator: string = '-'): string {
	// expects date in the form of "number_number" eg "1945_2000"
	let [start, end] = date.split('_');
	return `${start}${separator}${end}`;
}

export function formatTimePeriod(per: [number, number]): string {
	const [start, end] = per;
	if (start === end) return start.toString();
	return `${start}-${end}`;
}

export function formatDatasetTitle(title: string): string {
	// Replace underscores with spaces and capitalize each word
	return title
		.replace(/_/g, ' ')
		.split(' ')
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join(' ');
}
