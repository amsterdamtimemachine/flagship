export type AppErrorType = 'warning' | 'error' | 'info';

export interface AppError {
	id: string;
	type: AppErrorType;
	title: string;
	description: string;
	timestamp: Date;
	context?: Record<string, any>; 
}

export interface PageErrorData {
	errors: AppError[];
	hasErrors: boolean;
}
