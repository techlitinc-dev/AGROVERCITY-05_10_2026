import { apiClient } from './client';
import { handleApiError } from './errors';

/** Uploads namespace — multipart file upload. */
export const uploads = {
  /**
   * POST /uploads (multipart/form-data).
   * @param file the File/Blob to upload
   * @param extra additional form fields (e.g. folder, purpose)
   */
  upload: async (file: File | Blob, extra: Record<string, string> = {}): Promise<unknown> => {
    try {
      const form = new FormData();
      // backend expects a `files` list (list[UploadFile] = File(...))
      form.append('files', file);
      Object.entries(extra).forEach(([key, value]) => form.append(key, value));
      const res = await apiClient.post('/uploads', form);
      const payload = res.data?.data ?? res.data;
      // POST /uploads returns a list of UploadedFileOut — hand callers the first file.
      return Array.isArray(payload) ? payload[0] : payload;
    } catch (e) {
      // uploads are mutations — always throw, never fake success
      handleApiError(e);
    }
  },
};
