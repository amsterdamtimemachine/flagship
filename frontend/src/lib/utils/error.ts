import type { AppError, AppErrorType, PageErrorData } from '$types/error';

let errorIdCounter = 0;

export function createError(
	type: AppErrorType,
	title: string,
	description: string,
	context?: Record<string, any>
): AppError {
	return {
		id: `error_${++errorIdCounter}_${Date.now()}`,
		type,
		title,
		description,
		timestamp: new Date(),
		context
	};
}

export function createPageErrorData(errors: AppError[] = []): PageErrorData {
	return {
		errors,
		hasErrors: errors.length > 0
	};
}

// Helper functions for common error scenarios
export function createPeriodNotFoundError(requestedPeriod: string, availablePeriods: string[], fallbackPeriod: string): AppError {
	return createError(
		'warning',
		'Period Not Found',
		`Period "${requestedPeriod}" doesn't exist. Showing "${fallbackPeriod}" instead.`,
		{
			requestedPeriod,
			fallbackPeriod,
			totalAvailablePeriods: availablePeriods.length
		}
	);
}

//export function createDataLoadError(dataType: string, fallbackUsed: boolean = false): AppError {
//	return createError(
//		'error',
//		'Data Load Failed',
//		fallbackUsed 
//			? `Failed to load ${dataType}. Using cached data instead.`
//			: `Failed to load ${dataType}. Please try again.`,
//		{ dataType, fallbackUsed }
//	);
//}

export function createValidationError(field: string, value: any, reason: string): AppError {
	return createError(
		'warning',
		'Invalid Input',
		`${field} "${value}" is invalid: ${reason}`,
		{ field, value, reason }
	);
}
