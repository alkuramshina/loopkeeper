import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/auth-context';

type MediaUploadProps = {
  endpoint: string;
  hasImage: boolean;
  label: string;
  onChanged: () => Promise<unknown>;
};

export function MediaUpload({ endpoint, hasImage, label, onChanged }: MediaUploadProps) {
  const { api } = useAuth();
  const { t } = useTranslation();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function upload(file: File) {
    setPending(true);
    setError(undefined);
    try {
      const body = new FormData();
      body.set('file', file);
      await api.request(endpoint, { method: 'POST', body });
      await onChanged();
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? t(`errors.${cause.code}`, { defaultValue: t('errors.unexpected') })
          : t('errors.unexpected'),
      );
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    setPending(true);
    setError(undefined);
    try {
      await api.request<void>(endpoint, { method: 'DELETE' });
      await onChanged();
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? t(`errors.${cause.code}`, { defaultValue: t('errors.unexpected') })
          : t('errors.unexpected'),
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="media-upload">
      <label>
        {label}
        <input
          accept="image/jpeg,image/png,image/webp"
          disabled={pending}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
            event.target.value = '';
          }}
          type="file"
        />
      </label>
      {hasImage && (
        <button className="button-ghost" disabled={pending} onClick={() => void remove()} type="button">
          {t('common.delete')}
        </button>
      )}
      {pending && <span role="status">{t('common.loading')}</span>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <p className="muted">{t('media.uploadNotice')}</p>
    </div>
  );
}
