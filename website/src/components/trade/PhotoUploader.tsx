import { useRef, useState } from 'react';
import { compressImage, uploadTradeImage } from '../../lib/firebase';
import { useT } from '../../lib/i18n';
import { useSessionStore } from '../../stores/session';

interface PhotoUploaderProps {
  photos: string[];
  onChange: (photos: string[]) => void;
  min?: number;
  max?: number;
}

/**
 * Photo-first multi-image upload (spec F4: min 2, max 6) — compresses
 * client-side, uploads to Firebase Storage, exposes download URLs.
 * Upload failures keep the picker usable and report via inline error.
 */
export default function PhotoUploader({ photos, onChange, min = 2, max = 6 }: PhotoUploaderProps) {
  const t = useT();
  const uid = useSessionStore((s) => s.user?.id ?? s.user?.uid ?? 'anon');
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setError('');
    const room = max - photos.length;
    const picked = Array.from(files).slice(0, Math.max(0, room));
    if (picked.length < files.length) setError(t('photosMax', { max }));
    if (!picked.length) return;
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of picked) {
        const blob = await compressImage(file);
        uploaded.push(await uploadTradeImage(uid, blob));
      }
      onChange([...photos, ...uploaded]);
    } catch {
      setError(t('photosUploadFailed'));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="trade-field">
      <span className="av-label">
        {t('photosLabel')} ({photos.length}/{max}){min > 0 ? ' *' : ''}
      </span>
      <div className="trade-photo-grid">
        {photos.map((url) => (
          <div key={url} className="trade-photo-thumb">
            <img src={url} alt={t('photosLabel')} />
            <button
              type="button"
              className="trade-photo-remove"
              aria-label={t('photosRemove')}
              onClick={() => onChange(photos.filter((p) => p !== url))}
            >
              ✕
            </button>
          </div>
        ))}
        {photos.length < max ? (
          <button
            type="button"
            className="trade-photo-add"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <span className="av-spinner" aria-hidden /> : '＋'}
            <span>{uploading ? t('photosUploading') : t('photosAdd')}</span>
          </button>
        ) : null}
      </div>
      {error ? <p className="av-field-error">{error}</p> : null}
      {photos.length > 0 && photos.length < min ? (
        <p className="av-field-error">{t('photosMin', { min })}</p>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => void addFiles(e.target.files)}
      />
    </div>
  );
}
