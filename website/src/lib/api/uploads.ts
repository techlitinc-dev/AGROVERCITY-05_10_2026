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
      form.append('file', file);
      Object.entries(extra).forEach(([key, value]) => form.append(key, value));
      const res = await apiClient.post('/uploads', form);
      return res.data?.data ?? res.data;
    } catch (e) {
      // uploads are mutations — always throw, never fake success
      handleApiError(e);
    }
  },
};
