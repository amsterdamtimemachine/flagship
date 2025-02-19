export function printObjectFields(obj, prefix = '', maxArrayItems = 1) {
  // Handle null or undefined
  if (obj === null || obj === undefined) {
    console.log(`${prefix}${obj}`);
    return;
  }

  // Handle non-object types
  if (typeof obj !== 'object') {
    console.log(`${prefix}${obj}`);
    return;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    const totalLength = obj.length;
    const itemsToPrint = Math.min(maxArrayItems, totalLength);
    console.log(`${prefix}[Array with ${totalLength} items, showing first ${itemsToPrint}]`);
    
    obj.slice(0, itemsToPrint).forEach((item, index) => {
      console.log(`${prefix}[${index}]:`);
      printObjectFields(item, prefix + '  ', maxArrayItems);
    });
    
    if (totalLength > maxArrayItems) {
      console.log(`${prefix}... ${totalLength - maxArrayItems} more items`);
    }
    return;
  }

  // Handle objects
  Object.entries(obj).forEach(([key, value]) => {
    console.log(`${prefix}${key}:`);
    printObjectFields(value, prefix + '  ', maxArrayItems);
  });
}
