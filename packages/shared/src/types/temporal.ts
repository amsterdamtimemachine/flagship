export interface TimeSlice {
  key: string;           // "1900_1950" - for indexing
  label: string;         // "1900-1950" - for display  
  timeRange: {           // for API calls
    start: string;       // "1900-01-01"
    end: string;         // "1950-12-31"  
  };
  startYear: number;     // 1900 - for calculations
  endYear: number;       // 1950 - for calculations  
  durationYears: number; // 50 - for analysis
}
