import { getApiErrorMessage } from '../../lib/api-client';

export function ErrorMessage({ error }: { error: unknown }) {
  return error ? (
    <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
      {getApiErrorMessage(error)}
    </p>
  ) : null;
}
