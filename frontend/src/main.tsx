import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ApiClient, ApiError, Board, Campaign } from './api';
import './styles.css';

type Profile = { userId: string; email: string; name?: string };
type AuthResponse = { accessToken: string };

function App() {
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [activeCampaign, setActiveCampaign] = useState<Campaign | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState('');
  const api = useMemo(() => new ApiClient(() => token), [token]);

  async function loadSession(accessToken: string) {
    setToken(accessToken);
    const sessionApi = new ApiClient(() => accessToken);
    const me = await sessionApi.request<Profile>('/auth/me');
    const items = await sessionApi.request<Campaign[]>('/campaigns');
    setProfile(me); setCampaigns(items);
  }

  useEffect(() => { void (async () => {
    try { const result = await new ApiClient(() => null).request<AuthResponse>('/auth/refresh', { method: 'POST' }); await loadSession(result.accessToken); }
    catch { /* A missing refresh cookie means the user is signed out. */ }
  })(); }, []);

  async function submitAuth(event: React.FormEvent<HTMLFormElement>, route: 'login' | 'register') {
    event.preventDefault(); setError('');
    const data = new FormData(event.currentTarget);
    try {
      const result = await new ApiClient(() => null).request<AuthResponse>(`/auth/${route}`, { method: 'POST', body: JSON.stringify({ email: data.get('email'), password: data.get('password'), ...(route === 'register' ? { name: data.get('name') } : {}) }) });
      await loadSession(result.accessToken);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Authentication failed'); }
  }

  async function createCampaign(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget); setError('');
    try { const campaign = await api.request<Campaign>('/campaigns', { method: 'POST', body: JSON.stringify({ title: data.get('title'), description: data.get('description') }) }); setCampaigns([campaign, ...campaigns]); event.currentTarget.reset(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not create campaign'); }
  }

  async function openCampaign(campaign: Campaign) {
    setActiveCampaign(campaign); setError('');
    try { setBoard(await api.request<Board>(`/campaigns/${campaign.campaignId}/investigation-board`)); }
    catch (cause) { setBoard(null); setError(cause instanceof ApiError && cause.status === 404 ? 'Investigation board is unavailable for this campaign role.' : String(cause)); }
  }

  if (!profile) return <main className="auth"><h1>Loopkeeper</h1><p>Local campaign workspace</p><div className="auth-grid"><form onSubmit={(e) => submitAuth(e, 'login')}><h2>Sign in</h2><input name="email" type="email" placeholder="Email" required /><input name="password" type="password" placeholder="Password" required /><button>Sign in</button></form><form onSubmit={(e) => submitAuth(e, 'register')}><h2>Create account</h2><input name="name" placeholder="Name" /><input name="email" type="email" placeholder="Email" required /><input name="password" type="password" placeholder="Password" required /><button>Create account</button></form></div>{error && <p className="error">{error}</p>}</main>;

  return <main><header><div><h1>Loopkeeper</h1><span>{profile.name ?? profile.email}</span></div><button onClick={() => { void api.request('/auth/logout', { method: 'POST' }); setToken(null); setProfile(null); }}>Sign out</button></header><div className="layout"><aside><h2>Campaigns</h2>{campaigns.map((campaign) => <button className="campaign" key={campaign.campaignId} onClick={() => void openCampaign(campaign)}>{campaign.title}</button>)}<form onSubmit={createCampaign}><h3>New campaign</h3><input name="title" placeholder="Title" required /><textarea name="description" placeholder="Description" required /><button>Create</button></form></aside><section><h2>{activeCampaign?.title ?? 'Select a campaign'}</h2>{activeCampaign && <><p>Minimal workspace shell. Characters and notes screens are the next UI slices; the API is already available.</p>{board && <div className="board"><h3>Investigation board</h3>{board.cards.length === 0 ? <p>No cards yet.</p> : board.cards.map((card) => <article key={card.cardId} style={{ borderLeftColor: card.color }}><strong>{card.title}</strong><p>{card.content}</p><small>{card.tags.join(', ')}</small></article>)}</div>}</>}{error && <p className="error">{error}</p>}</section></div></main>;
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
