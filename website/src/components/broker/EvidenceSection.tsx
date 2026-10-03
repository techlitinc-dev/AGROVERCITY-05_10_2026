import { useRef, useState } from 'react';
import { toast } from '../toast';
import { uploadDealEvidence, type Deal, type EvidenceEntry } from '../../lib/api/broker';
import { compressImage } from '../../lib/firebase';
import { useT } from '../../lib/i18n';

const KINDS: Array<EvidenceEntry['kind']> = ['photo', 'weighbridge', 'loading', 'delivery', 'damage'];

interface EvidenceSectionProps {
  deal: Deal;
  role: 'broker' | 'farmer';
  /** Called after a successful upload so the parent can re-fetch the deal. */
  onUploaded: () => void;
}

/**
 * Deal evidence (spec F8/B10) — weighbridge slip / loading / delivery photos
 * via the multipart evidence endpoint. Client-compressed (≤5 MB, JPEG) before
 * upload; EXIF/GPS stripping happens in compressImage's canvas re-encode (D2).
 * Hidden entirely when the deal doc carries no evidence array.
 */
export default function EvidenceSection({ deal, role, onUploaded }: EvidenceSectionProps) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<EvidenceEntry['kind']>('photo');
  const [uploading, setUploading] = useState(false);

  if (!deal.evidence) return null;

  const addFiles = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file || uploading) return;
    setUploading(true);
    try {
      const blob = await compressImage(file);
      const compressed = new File([blob], 'evidence.jpg', { type: 'image/jpeg' });
      await uploadDealEvidence(deal.id, compressed, role, kind);
      toast(t('evidenceUploaded'));
      onUploaded();
    } catch {
      toast(t('photosUploadFailed'), { error: true });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <section>
      <p className="trade-section-title">{t('ddEvidenceTitle')}</p>
      <div className="broker-pipeline-chips">
        {KINDS.map((k) => (
          <button
            key={k}
            type="button"
            className={`av-chip${kind === k ? ' selected' : ''}`}
            onClick={() => setKind(k)}
          >
            {t(`evidenceKind_${k}`)}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="av-btn av-btn-ghost"
        style={{ marginTop: 8 }}
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? <span className="av-spinner" aria-hidden /> : `📷 ${t('ddEvidenceAdd')}`}
      </button>
      {deal.evidence.length > 0 ? (
        <div className="trade-list">
          {deal.evidence.map((entry) => (
            <div key={entry.id} className="trade-card" style={{ cursor: 'default' }}>
              <div className="trade-card-row">
                <span className="trade-card-title">
                  {t(`evidenceKind_${entry.kind ?? 'photo'}`)}
                </span>
                <span className="trade-card-sub">
                  {new Date(entry.createdAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
              </div>
              {/^https?:\/\//.test(entry.blobPath) ? (
                <img className="broker-evidence-img" src={entry.blobPath} alt={t('ddEvidenceTitle')} />
              ) : (
                <span className="trade-card-sub">{entry.blobPath}</span>
              )}
            </div>
          ))}
        </div>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png"
        hidden
        onChange={(e) => void addFiles(e.target.files)}
      />
    </section>
  );
}
