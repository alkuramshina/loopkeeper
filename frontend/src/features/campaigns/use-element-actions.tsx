import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ApiError,
  CampaignElement,
  CampaignElementAccess,
} from '../../api/client';
import { useAuth } from '../../auth/auth-context';
import { useToast } from '../../components/ui/toast';
import { HideDialog, RevealDialog } from './element-access-dialogs';
import { apiErrorText } from './element-model';

/** Puts a shared material on the board as a reference card. */
export function useAddToBoard(elementId: string) {
  const { campaignId } = useParams();
  const { api } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: () =>
      api.request(`/campaigns/${campaignId}/cards`, {
        method: 'POST',
        body: JSON.stringify({ cardKind: 'ELEMENT_REFERENCE', elementId }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['board', campaignId] });
      toast.show({ message: t('elements.addedToBoard') });
    },
    onError: (cause) =>
      toast.show({
        message:
          cause instanceof ApiError && cause.status === 409
            ? t('elements.alreadyOnBoard')
            : apiErrorText(cause, t),
      }),
  });
}

type AccessDialog =
  { kind: 'reveal' } | { kind: 'hide'; target: CampaignElementAccess };

/**
 * Changing who sees a material. Opening it to everyone first shows what they
 * will get; taking it back from everyone says what leaves the board. Other
 * changes apply at once. `beforeChange` saves pending edits first, so the
 * preview shows the saved text.
 */
export function useAccessChange({
  element,
  owner,
  beforeChange,
}: {
  element: CampaignElement;
  owner: boolean;
  beforeChange: () => Promise<boolean>;
}) {
  const { campaignId } = useParams();
  const { api } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [dialog, setDialog] = useState<AccessDialog>();
  const [dialogError, setDialogError] = useState<string>();

  const change = useMutation({
    mutationFn: (access: CampaignElementAccess) =>
      api.request<CampaignElement>(`/elements/${element.elementId}/access`, {
        method: 'PATCH',
        body: JSON.stringify({ access }),
      }),
    onSuccess: (saved, access) => {
      queryClient.setQueryData(['element', element.elementId], saved);
      void queryClient.invalidateQueries({
        queryKey: ['elements', campaignId],
      });
      void queryClient.invalidateQueries({ queryKey: ['board', campaignId] });
      setDialog(undefined);
      if (owner)
        toast.show({
          message: t(
            access === 'SHARED' ? 'elements.revealed' : 'elements.hidden',
          ),
        });
    },
    onError: (cause) => {
      if (dialog) setDialogError(apiErrorText(cause, t));
      else toast.show({ message: apiErrorText(cause, t) });
    },
  });

  const open = async (next: AccessDialog) => {
    if (!(await beforeChange())) return;
    setDialogError(undefined);
    setDialog(next);
  };

  const request = (access: CampaignElementAccess) => {
    if (access === element.access) return;
    if (access === 'SHARED') void open({ kind: 'reveal' });
    else if (element.access === 'SHARED')
      void open({ kind: 'hide', target: access });
    else change.mutate(access);
  };

  const dialogs =
    dialog?.kind === 'reveal' ? (
      <RevealDialog
        element={element}
        error={dialogError}
        onClose={() => setDialog(undefined)}
        onConfirm={() => change.mutate('SHARED')}
        owner={owner}
        pending={change.isPending}
      />
    ) : dialog?.kind === 'hide' ? (
      <HideDialog
        element={element}
        error={dialogError}
        onClose={() => setDialog(undefined)}
        onConfirm={() => change.mutate(dialog.target)}
        owner={owner}
        pending={change.isPending}
      />
    ) : null;

  return { request, dialogs, pending: change.isPending };
}
