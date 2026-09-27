import {
  FormEvent,
  InputHTMLAttributes,
  ReactNode,
  useId,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TFunction } from 'i18next';
import { Check, Upload } from 'lucide-react';
import { ApiError } from '../../api/client';
import { useAuth } from '../../auth/auth-context';
import { Avatar } from '../../components/avatar';
import { formText } from '../../components/form-text';
import { Button } from '../../components/ui/button';
import { iconProps } from '../../components/ui/icon';
import { AccountShell } from './account-shell';

function apiErrorMessage(cause: unknown, t: TFunction) {
  return cause instanceof ApiError
    ? t(`errors.${cause.code}`, { defaultValue: t('errors.unexpected') })
    : t('errors.unexpected');
}

/** A field with its hint outside the label, announced as the description. */
function AccountField({
  label,
  hint,
  ...input
}: InputHTMLAttributes<HTMLInputElement> & {
  label: ReactNode;
  hint?: string;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className="account-field">
      <label htmlFor={id}>{label}</label>
      <input aria-describedby={hint ? hintId : undefined} id={id} {...input} />
      {hint && (
        <span className="account-hint" id={hintId}>
          {hint}
        </span>
      )}
    </div>
  );
}

export function AccountSettingsPage() {
  const { api, profile, updateProfile } = useAuth();
  const { t } = useTranslation();
  const savedName = profile?.name ?? '';
  const [name, setName] = useState(savedName);
  const [profileError, setProfileError] = useState<string>();
  const [profileSaved, setProfileSaved] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [avatarError, setAvatarError] = useState<string>();
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const dirty = name.trim() !== savedName;

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileError(undefined);
    setProfileSaved(false);
    setSavingProfile(true);
    try {
      const trimmed = name.trim();
      await updateProfile({ name: trimmed });
      setName(trimmed);
      setProfileSaved(true);
    } catch (cause) {
      setProfileError(apiErrorMessage(cause, t));
    } finally {
      setSavingProfile(false);
    }
  }

  async function uploadAvatar(file: File) {
    if (file.size === 0) return;

    setAvatarError(undefined);
    setUploadingAvatar(true);
    try {
      const body = new FormData();
      body.set('file', file);
      await api.request('/users/me/avatar', { method: 'POST', body });
      await updateProfile({ name: savedName });
    } catch (cause) {
      setAvatarError(apiErrorMessage(cause, t));
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function deleteAvatar() {
    setAvatarError(undefined);
    setUploadingAvatar(true);
    try {
      await api.request<void>('/users/me/avatar', { method: 'DELETE' });
      await updateProfile({ name: savedName });
    } catch (cause) {
      setAvatarError(apiErrorMessage(cause, t));
    } finally {
      setUploadingAvatar(false);
    }
  }

  return (
    <AccountShell lead={t('account.profileLead')} title={t('account.profile')}>
      <form
        className="account-card"
        onSubmit={(event) => void saveProfile(event)}
      >
        <div className="account-card-section account-avatar-row">
          <Avatar
            alt={profile?.name || profile?.email || ''}
            imageUrl={profile?.avatarUrl}
            seed={profile?.name || profile?.email || ''}
            size="large"
          />
          <div className="account-avatar-actions">
            <div className="account-actions">
              <label
                className="ui-button ui-button-secondary account-upload"
                aria-disabled={uploadingAvatar}
              >
                <Upload {...iconProps} size={16} />
                {t('account.uploadPhoto')}
                <input
                  accept="image/jpeg,image/png,image/webp"
                  className="visually-hidden"
                  disabled={uploadingAvatar}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadAvatar(file);
                    event.target.value = '';
                  }}
                  type="file"
                />
              </label>
              {profile?.avatarUrl?.startsWith('/media/') && (
                <Button
                  disabled={uploadingAvatar}
                  onClick={() => void deleteAvatar()}
                  variant="quiet"
                >
                  {t('account.deletePhoto')}
                </Button>
              )}
            </div>
            <p className="account-hint">{t('account.avatarNotice')}</p>
            {avatarError && (
              <p className="form-error" role="alert">
                {avatarError}
              </p>
            )}
          </div>
        </div>
        <div className="account-card-section account-fields">
          <AccountField
            hint={t('account.nameHint')}
            label={t('auth.name')}
            maxLength={100}
            name="name"
            onChange={(event) => {
              setName(event.target.value);
              setProfileSaved(false);
            }}
            required
            value={name}
          />
          <AccountField
            disabled
            hint={t('account.emailHint')}
            label={t('auth.email')}
            type="email"
            value={profile?.email ?? ''}
          />
          {profileError && (
            <p className="form-error" role="alert">
              {profileError}
            </p>
          )}
        </div>
        <footer className="account-card-footer">
          {profileSaved && !dirty && (
            <span className="account-saved" role="status">
              <Check {...iconProps} size={16} />
              {t('account.saved')}
            </span>
          )}
          {dirty && (
            <Button
              onClick={() => {
                setName(savedName);
                setProfileError(undefined);
              }}
              size="lg"
            >
              {t('common.cancel')}
            </Button>
          )}
          <Button
            disabled={!dirty || savingProfile}
            size="lg"
            type="submit"
            variant="primary"
          >
            {t('account.saveChanges')}
          </Button>
        </footer>
      </form>
    </AccountShell>
  );
}

export function PasswordSettingsPage() {
  const { api, signOut } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [passwordError, setPasswordError] = useState<string>();
  const [changingPassword, setChangingPassword] = useState(false);

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError(undefined);
    const form = new FormData(event.currentTarget);
    const newPassword = formText(form, 'newPassword');
    const confirmation = formText(form, 'confirmation');
    if (newPassword !== confirmation) {
      setPasswordError(t('account.passwordMismatch'));
      return;
    }

    setChangingPassword(true);
    try {
      await api.request<void>('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: form.get('currentPassword'),
          newPassword,
        }),
      });
      await signOut();
      void navigate('/sign-in', { replace: true });
    } catch (cause) {
      setPasswordError(apiErrorMessage(cause, t));
      setChangingPassword(false);
    }
  }

  return (
    <AccountShell lead={t('account.passwordNotice')} title={t('account.login')}>
      <form
        className="account-card"
        onSubmit={(event) => void changePassword(event)}
      >
        <div className="account-card-section account-fields">
          <AccountField
            autoComplete="current-password"
            label={t('account.currentPassword')}
            name="currentPassword"
            required
            type="password"
          />
          <AccountField
            autoComplete="new-password"
            hint={t('auth.passwordHint')}
            label={t('account.newPassword')}
            minLength={8}
            name="newPassword"
            required
            type="password"
          />
          <AccountField
            autoComplete="new-password"
            label={t('account.confirmPassword')}
            minLength={8}
            name="confirmation"
            required
            type="password"
          />
          {passwordError && (
            <p className="form-error" role="alert">
              {passwordError}
            </p>
          )}
        </div>
        <footer className="account-card-footer">
          <Button
            disabled={changingPassword}
            size="lg"
            type="submit"
            variant="primary"
          >
            {t('account.changePassword')}
          </Button>
        </footer>
      </form>
    </AccountShell>
  );
}
