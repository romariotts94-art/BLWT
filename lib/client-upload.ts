const imageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const documentTypes = new Set(['application/pdf', ...imageTypes]);

export function uploadError(file: File, maxMb: number, kind: 'photo' | 'document' = 'photo'): string | null {
  const allowed = kind === 'photo' ? imageTypes : documentTypes;
  if (!allowed.has(file.type)) return kind === 'photo'
    ? 'Подойдёт фотография JPEG, PNG или WebP.'
    : 'Подойдёт документ PDF или изображение JPEG, PNG, WebP.';
  if (!file.size) return 'Файл пустой. Выберите другой файл.';
  const maxBytes = maxMb * 1024 * 1024;
  if (file.size > maxBytes) {
    const size = (file.size / 1024 / 1024).toLocaleString('ru-RU', { maximumFractionDigits: 1 });
    return `Файл «${file.name}» весит ${size} МБ. Максимум — ${maxMb} МБ. Выберите файл поменьше.`;
  }
  return null;
}
