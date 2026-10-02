import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ApiError, Campaign, CampaignElement } from '../../api/client';
import { useAuth } from '../../auth/auth-context';
import { useToast } from '../../components/ui/toast';
import { apiErrorText } from './element-model';
import { splitQuickNote } from './player-model';
import {
  emptyQuickNote,
  noteProfile,
  NoteProfile,
  QuickNoteDraft,
} from './quick-note';

export function readQuickNote(
  key: string,
  profile: NoteProfile,
): QuickNoteDraft {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(key) ?? 'null');
    if (
      value &&
      typeof value === 'object' &&
      'text' in value &&
      typeof value.text === 'string' &&
      value.text.length <= 10000 &&
      'access' in value &&
      typeof value.access === 'string' &&
      ['PRIVATE', 'MASTER_ONLY', 'SHARED'].includes(value.access)
    ) {
      return {
        text: value.text,
        access: profile.accessOptions.includes(
          value.access as QuickNoteDraft['access'],
        )
          ? (value.access as QuickNoteDraft['access'])
          : profile.defaultAccess,
      };
    }
  } catch {
    /* Storage can be unavailable. */
  }
  return emptyQuickNote(profile);
}
function useMedia(query: string) {
  const [matches, setMatches] = useState(
    () => window.matchMedia?.(query).matches ?? false,
  );
  useEffect(() => {
    const media = window.matchMedia?.(query);
    if (!media) return;
    const change = () => setMatches(media.matches);
    change();
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, [query]);
  return matches;
}
type QuickNoteState = {
  profile: NoteProfile | null;
  open: boolean;
  focusRequest: number;
  pinned: boolean;
  canPin: boolean;
  mobile: boolean;
  draft: QuickNoteDraft;
  pending: boolean;
  error?: string;
  openNote: () => void;
  close: () => void;
  togglePin: () => void;
  setDraft: (draft: QuickNoteDraft) => void;
  submit: () => void;
};
const Context = createContext<QuickNoteState | null>(null);
export function useQuickNote() {
  return useContext(Context);
}
export function QuickNoteProvider({
  campaign,
  children,
}: {
  campaign: Campaign;
  children: ReactNode;
}) {
  const { api, profile: user } = useAuth();
  const [unavailable, setUnavailable] = useState(false);
  const profile =
    user && !unavailable ? noteProfile(campaign.currentUserRole) : null;
  const key = `quick-note:${user?.userId}:${campaign.campaignId}`;
  const pinKey = `${key}:pinned`;
  const [draft, setDraftState] = useState<QuickNoteDraft>(() =>
    profile ? readQuickNote(key, profile) : { text: '', access: 'PRIVATE' },
  );
  const draftHydrated = useRef(Boolean(profile));
  const [open, setOpen] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);
  const [preferredPin, setPreferredPin] = useState(() => {
    try {
      return localStorage.getItem(pinKey) === 'true';
    } catch {
      return false;
    }
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const inFlight = useRef(false);
  const alive = useRef(true);
  const permitted = useRef(profile);
  permitted.current = profile;
  const opener = useRef<HTMLElement | null>(null);
  const canPin = useMedia('(min-width: 1280px)');
  const mobile = useMedia('(max-width: 599px)');
  const actualPin = preferredPin && canPin;
  const latestPin = useRef(actualPin);
  latestPin.current = actualPin;
  const queryClient = useQueryClient();
  const toast = useToast();
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  useLayoutEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    setUnavailable(false);
  }, [campaign]);
  useEffect(() => {
    if (!profile) {
      setOpen(false);
      return;
    }
    if (!draftHydrated.current) {
      draftHydrated.current = true;
      setDraftState(readQuickNote(key, profile));
      return;
    }
    setDraftState((value) =>
      profile.accessOptions.includes(value.access)
        ? value
        : { ...value, access: profile.defaultAccess },
    );
  }, [profile]);
  useEffect(() => {
    if (!profile) return;
    try {
      if (draft.text) sessionStorage.setItem(key, JSON.stringify(draft));
      else sessionStorage.removeItem(key);
    } catch {
      /* Keep the in-memory draft. */
    }
  }, [draft, key, profile]);
  const focusInput = () =>
    document
      .querySelector<HTMLTextAreaElement>('[data-quick-note] textarea')
      ?.focus();
  const openNote = () => {
    if (!permitted.current) return;
    opener.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setOpen(true);
    setFocusRequest((value) => value + 1);
  };
  const close = () => {
    setOpen(false);
    requestAnimationFrame(() => {
      if (!alive.current || !permitted.current) return;
      const target = opener.current;
      if (target?.isConnected && target.getClientRects().length) target.focus();
      else
        Array.from(
          document.querySelectorAll<HTMLElement>('[data-quick-note-trigger]'),
        )
          .find((item) => item.getClientRects().length)
          ?.focus();
    });
  };
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('quick-note') !== '1') return;
    if (profile) openNote();
    params.delete('quick-note');
    void navigate(
      {
        pathname: location.pathname,
        search: params.toString(),
        hash: location.hash,
      },
      { replace: true },
    );
  }, [location.search, profile]);
  const submit = async () => {
    if (!permitted.current || inFlight.current || !draft.text.trim()) return;
    const sendingProfile = permitted.current;
    const sent = { ...draft };
    const submittedFromForm = Boolean(
      document.activeElement?.closest('[data-quick-note]'),
    );
    inFlight.current = true;
    setPending(true);
    setError(undefined);
    try {
      const note = await api.request<CampaignElement>(
        `/campaigns/${campaign.campaignId}/elements`,
        {
          method: 'POST',
          body: JSON.stringify({
            type: 'NOTE',
            access: sent.access,
            ...splitQuickNote(sent.text),
          }),
        },
      );
      if (alive.current)
        queryClient.setQueryData(['element', note.elementId], note);
      void queryClient.invalidateQueries({
        queryKey: ['elements', campaign.campaignId],
      });
      try {
        const stored: unknown = JSON.parse(
          sessionStorage.getItem(key) ?? 'null',
        );
        if (
          stored &&
          typeof stored === 'object' &&
          'text' in stored &&
          stored.text === sent.text &&
          'access' in stored &&
          stored.access === sent.access
        )
          sessionStorage.removeItem(key);
      } catch {
        /* Storage can be unavailable. */
      }
      if (!alive.current) return;
      setDraftState(emptyQuickNote(permitted.current ?? sendingProfile));
      if (!permitted.current) return;
      const focusInForm = Boolean(
        document.activeElement?.closest('[data-quick-note]') ||
        (submittedFromForm && document.activeElement === document.body),
      );
      if (!latestPin.current) close();
      else if (focusInForm)
        requestAnimationFrame(() => {
          if (
            alive.current &&
            permitted.current &&
            (document.activeElement?.closest('[data-quick-note]') ||
              document.activeElement === document.body)
          )
            focusInput();
        });
      toast.show({
        message: t('case.quickNote.savedToast'),
        action: {
          label: t('case.quickNote.open'),
          to: `/campaigns/${campaign.campaignId}/notes/${note.elementId}`,
        },
      });
    } catch (cause) {
      if (alive.current && cause instanceof ApiError && cause.status === 404) {
        setUnavailable(true);
        setOpen(false);
        void queryClient.invalidateQueries({
          queryKey: ['campaign', campaign.campaignId],
        });
      }
      if (alive.current && permitted.current) setError(apiErrorText(cause, t));
    } finally {
      inFlight.current = false;
      if (alive.current) setPending(false);
    }
  };
  return (
    <Context.Provider
      value={{
        profile,
        open: open && Boolean(profile),
        focusRequest,
        pinned: actualPin,
        canPin,
        mobile,
        draft,
        pending,
        error,
        openNote,
        close,
        togglePin: () =>
          setPreferredPin((value) => {
            try {
              localStorage.setItem(pinKey, String(!value));
            } catch {
              /* Preference remains in memory. */
            }
            return !value;
          }),
        setDraft: (value) => {
          if (profile && !inFlight.current) {
            setDraftState(value);
            setError(undefined);
          }
        },
        submit: () => {
          void submit();
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
