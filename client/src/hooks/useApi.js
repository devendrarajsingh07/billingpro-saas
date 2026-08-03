import { useState, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';

/**
 * Generic API call hook with loading, error, data state
 * @param {Function} apiFn - The async function to call
 * @param {object} options
 * @param {boolean} options.showErrorToast
 * @param {boolean} options.showSuccessToast
 * @param {string} options.successMessage
 */
export default function useApi(apiFn, options = {}) {
  const {
    showErrorToast = true,
    showSuccessToast = false,
    successMessage = 'Done!',
  } = options;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const execute = useCallback(
    async (...args) => {
      setLoading(true);
      setError(null);
      try {
        const result = await apiFn(...args);
        setData(result);
        if (showSuccessToast) toast.success(successMessage);
        return result;
      } catch (err) {
        const msg =
          err?.response?.data?.message ||
          err?.message ||
          'Something went wrong';
        setError(msg);
        if (showErrorToast) toast.error(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [apiFn, showErrorToast, showSuccessToast, successMessage]
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return { data, loading, error, execute, reset, setData };
}
