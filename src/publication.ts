import type { Draft } from '../shared/contracts';

type Requests = { publish(id: string, token: string): Promise<Draft>; read(id: string): Promise<Draft> };

export async function submitPublication(draft: Draft, token: string, requests: Requests, onSnapshot: (draft: Draft) => void) {
  try {
    const published = await requests.publish(draft.id, token);
    onSnapshot(published);
    return published;
  } catch (error) {
    onSnapshot({ ...draft, status: 'uncertain', publicationError: 'Результат отправки не подтверждён. Исходный вариант сохранён для проверки.' });
    // A failed refresh must leave the copy locked while the result is unknown.
    const current = await requests.read(draft.id).catch(() => null);
    if (current) onSnapshot(current);
    throw error;
  }
}
