export function parseCSV(csvContent: string) {
    const lines = csvContent.split(/\r?\n/);
    if (lines.length === 0) return { data: [], headers: [] };

    const headers = lines[0].split(',').map(header => 
        header.trim().replace(/^["'](.*)["']$/, '$1')
    );

    const data = lines.slice(1)
        .filter(line => line.trim())
        .map(line => {
            const values: string[] = [];
            let inQuotes = false;
            let currentValue = '';
            
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                
                if (char === '"') {
                    if (inQuotes && line[i + 1] === '"') {
                        currentValue += '"';
                        i++;
                    } else {
                        inQuotes = !inQuotes;
                    }
                } else if (char === ',' && !inQuotes) {
                    values.push(currentValue.trim());
                    currentValue = '';
                } else {
                    currentValue += char;
                }
            }
            
            values.push(currentValue.trim());

            return headers.reduce((obj, header, index) => {
                obj[header] = values[index] || '';
                return obj;
            }, {} as Record<string, string>);
        });

    return { data, headers };
}
