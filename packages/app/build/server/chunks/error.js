let errorIdCounter = 0;
function createError(type, title, description, context) {
  return {
    id: `error_${++errorIdCounter}_${Date.now()}`,
    type,
    title,
    description,
    timestamp: /* @__PURE__ */ new Date(),
    context
  };
}
function createPageErrorData(errors = []) {
  return {
    errors,
    hasErrors: errors.length > 0
  };
}
function createValidationError(field, value, reason) {
  return createError(
    "warning",
    "Invalid Input",
    `${field} "${value}" is invalid: ${reason}`,
    { field, value, reason }
  );
}
export {
  createError as a,
  createValidationError as b,
  createPageErrorData as c
};
