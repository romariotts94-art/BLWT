const bodyError = (status: number, message: string) => Object.assign(new Error(message), { status });

// Count received bytes as well as Content-Length: chunked requests have no header.
async function readBytes(request: Request, limit: number) {
  if (Number(request.headers.get('content-length') || 0) > limit) {
    throw bodyError(413, 'Запрос слишком большой');
  }
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw bodyError(413, 'Запрос слишком большой');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

export async function readJsonBody(request: Request, limit = 128 * 1024): Promise<unknown> {
  const bytes = await readBytes(request, limit);
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw bodyError(400, 'Некорректный JSON запроса'); }
}

export async function readFormBody(request: Request, limit = 16 * 1024 * 1024) {
  const bytes = await readBytes(request, limit);
  try {
    return await new Response(bytes, { headers: { 'Content-Type': request.headers.get('content-type') || '' } }).formData();
  } catch { throw bodyError(400, 'Некорректная форма запроса'); }
}
