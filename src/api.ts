export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: { ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers },
    credentials: 'same-origin',
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? 'Не удалось выполнить действие.');
  return data as T;
}

export function downloadFile(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function message(error: unknown) {
  return error instanceof Error ? error.message : 'Не удалось выполнить действие.';
}
