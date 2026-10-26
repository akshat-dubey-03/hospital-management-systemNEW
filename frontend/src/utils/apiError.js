// Extracts a user-facing message (and per-field messages) from an Axios error
// using the backend's { success, message, errors: [{ field, message }] } shape.

export function apiErrorMessage(err, fallback = 'Something went wrong. Please try again.') {
  if (!err?.response) return 'Cannot reach the server. Check that the backend is running.';
  const { message, errors } = err.response.data || {};
  if (Array.isArray(errors) && errors.length) {
    return `${message || fallback} ${errors.map((e) => (e.field ? `${e.field}: ${e.message}` : e.message)).join(' · ')}`;
  }
  return message || fallback;
}

export function apiFieldErrors(err) {
  const errors = err?.response?.data?.errors;
  if (!Array.isArray(errors)) return {};
  return Object.fromEntries(errors.filter((e) => e.field).map((e) => [e.field, e.message]));
}
