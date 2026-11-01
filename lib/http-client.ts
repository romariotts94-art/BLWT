/** Validate the JSON envelope before UI consumers read API fields. */
export async function readJson(response: Response): Promise<Record<string, any>> {
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new Error(response.ok
      ? 'Сервер вернул некорректный ответ. Попробуйте ещё раз.'
      : 'Не удалось получить ответ сервера. Попробуйте ещё раз.');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Сервер вернул некорректный ответ. Попробуйте ещё раз.');
  }
  return value as Record<string, any>;
}
