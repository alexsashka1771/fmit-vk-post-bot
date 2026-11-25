import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { ArrowUpRight, Check, CheckCircle2, ChevronRight, ExternalLink, FileText, LogOut, MessagesSquare, Plus, PlugZap, Sparkles, SquarePen, X } from 'lucide-react';
import { composePost } from '../shared/contracts';
import type { AppStatus, Brief, Draft, DraftPatch } from '../shared/contracts';
import { api, downloadFile, message } from './api';
import { submitPublication } from './publication';
import Editor from './components/Editor';
import DraftPreview from './components/DraftPreview';
import Login from './components/Login';
import { OrbitalArt, VkMark } from './components/Art';
import PublishDialog from './components/PublishDialog';

const Library = lazy(() => import('./components/Library'));
const BotDemo = lazy(() => import('./components/BotDemo'));
const Settings = lazy(() => import('./components/Settings'));
type Page = 'editor' | 'library' | 'bot' | 'settings';
type Notice = { text: string; error?: boolean };

export default function App() {
  const [status, setStatus] = useState<AppStatus | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [active, setActive] = useState<Draft | null>(null);
  const [dirty, setDirty] = useState(false);
  const [page, setPage] = useState<Page>('editor');
  const [loading, setLoading] = useState(true);
  const [startupError, setStartupError] = useState('');
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [confirmation, setConfirmation] = useState<{ token: string; draft: Draft } | null>(null);

  const refreshDrafts = useCallback(async () => { setDrafts(await api<Draft[]>('/drafts')); }, []);
  const initialize = useCallback(async () => {
    setLoading(true); setStartupError('');
    try {
      const currentStatus = await api<AppStatus>('/status'); setStatus(currentStatus);
      if (currentStatus.authenticated) {
        const currentDrafts = await api<Draft[]>('/drafts'); setDrafts(currentDrafts);
        const requested = new URLSearchParams(location.search).get('draft');
        if (requested) setActive(currentDrafts.find(draft => draft.id === requested) ?? null);
      }
    } catch (error) { setStartupError(message(error)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void initialize(); }, [initialize]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(null), 5500); return () => clearTimeout(timer); }, [notice]);

  async function persist() {
    if (!active) return null;
    if (!dirty) return active;
    const patch: DraftPatch = { title: active.title, body: active.body, hashtags: active.hashtags, coverTitle: active.coverTitle, coverSubtitle: active.coverSubtitle, coverStyle: active.coverStyle };
    const updated = await api<Draft>(`/drafts/${active.id}`, { method: 'PATCH', body: JSON.stringify(patch) });
    setActive(updated); setDirty(false); await refreshDrafts();
    return updated;
  }

  async function action(name: string, work: () => Promise<void>) {
    setBusy(name);
    try { await work(); } catch (error) { setNotice({ text: message(error), error: true }); }
    finally { setBusy(''); }
  }

  async function generate(brief: Brief) {
    await action('generate', async () => {
      if (dirty) await persist();
      const draft = await api<Draft>('/drafts', { method: 'POST', body: JSON.stringify(brief) });
      setActive(draft); setDirty(false); await refreshDrafts();
      setNotice({ text: draft.source === 'ai' ? 'Пост готов. Проверьте факты и добавьте свой штрих.' : 'Демо-пост готов. Текст и обложка сохранены в черновиках.' });
    });
  }

  async function newPost() {
    await action('save', async () => { if (dirty) await persist(); setActive(null); setDirty(false); setPage('editor'); history.replaceState(null, '', location.pathname); });
  }

  async function openDraft(draft: Draft) {
    await action('open', async () => { if (dirty) await persist(); setActive(draft); setDirty(false); setPage('editor'); history.replaceState(null, '', `?draft=${draft.id}`); window.scrollTo({ top: 0 }); });
  }

  function edit(patch: DraftPatch) { setActive(current => current ? { ...current, ...patch } : current); setDirty(true); }
  async function save() { await action('save', async () => { await persist(); setNotice({ text: 'Правки сохранены. Предпросмотр обновлён.' }); }); }
  async function download() {
    await action('download', async () => {
      const draft = await persist(); if (!draft) return;
      const response = await fetch(`/api/drafts/${draft.id}/cover.png?download=1`);
      if (!response.ok) throw new Error('Не удалось скачать обложку. Попробуйте ещё раз.');
      downloadFile(await response.blob(), `fmit-${draft.id.slice(0, 8)}.png`);
      setNotice({ text: 'Обложка скачана в PNG, 1600 × 1000.' });
    });
  }
  async function copy() { await action('copy', async () => { if (active) { await navigator.clipboard.writeText(composePost(active)); setNotice({ text: 'Текст поста скопирован.' }); } }); }
  async function previewPublication() { await action('confirm', async () => { const draft = await persist(); if (!draft) return; const ticket = await api<{ token: string }>(`/drafts/${draft.id}/confirm`, { method: 'POST', body: JSON.stringify({ revision: draft.revision }) }); setConfirmation({ token: ticket.token, draft }); }); }
  async function publish() {
    if (!confirmation) return;
    await action('publish', async () => {
      try {
        await submitPublication(confirmation.draft, confirmation.token, {
          publish: (id, token) => api<Draft>(`/drafts/${id}/publish`, { method: 'POST', body: JSON.stringify({ token }) }),
          read: id => api<Draft>(`/drafts/${id}`),
        }, snapshot => { setActive(snapshot); setDirty(false); });
        setNotice({ text: 'Пост опубликован в сообществе ФМиИТ.' });
      } finally { setConfirmation(null); await refreshDrafts(); }
    });
  }
  async function refreshStatus() { await action('status', async () => { setStatus(await api<AppStatus>('/status')); setNotice({ text: 'Статусы подключения обновлены.' }); }); }

  if (loading) return <main className="app-loading"><span className="spinner" /><p>Открываем контент-студию…</p></main>;
  if (startupError || !status) return <main className="app-loading"><h1>Не удалось открыть студию</h1><p>{startupError}</p><button type="button" className="button button-primary" onClick={() => void initialize()}>Попробовать снова</button></main>;
  if (!status.authenticated) return <Login onLogin={async password => { await api('/auth/login', { method: 'POST', body: JSON.stringify({ password }) }); await initialize(); }} />;

  const nav = [{ id: 'editor', name: 'Новый пост', icon: SquarePen }, { id: 'library', name: 'Черновики', icon: FileText }, { id: 'bot', name: 'ВК-бот', icon: MessagesSquare }, { id: 'settings', name: 'Подключение', icon: PlugZap }] as const;
  const pageName = { editor: 'Новый пост', library: 'Черновики', bot: 'ВК-бот', settings: 'Подключение' }[page];

  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Перейти к содержимому</a>
    <aside className="sidebar"><a className="studio-brand" href="/" onClick={event => { event.preventDefault(); setPage('editor'); }}><span className="brand-monogram">f<span>m</span>it<span className="brand-dot">.</span></span><span className="brand-descriptor">КОНТЕНТ-СТУДИЯ</span></a><div className="sidebar-community"><img src="/brand/avatar.jpg" alt="" width="38" height="38" /><div><strong>ФМиИТ</strong><span>СФ УУНиТ</span></div><span className="community-check"><Check size={12} /></span></div><div className="sidebar-label">РАБОЧЕЕ ПРОСТРАНСТВО</div><nav aria-label="Основная навигация">{nav.map(item => <button key={item.id} type="button" className={page === item.id ? 'nav-item active' : 'nav-item'} onClick={() => setPage(item.id)} aria-current={page === item.id ? 'page' : undefined}><item.icon size={19} strokeWidth={1.7} /><span>{item.name}</span>{item.id === 'library' && <span className="nav-count">{drafts.length}</span>}{page === item.id && item.id !== 'library' && <span className="nav-dot" />}</button>)}</nav><div className="sidebar-bottom"><div className="sidebar-motto"><span className="motto-star">✳</span><p>Меньше рутины.<br /><strong>Больше историй.</strong></p><span>Идеи, достойные публикации.</span></div><a href={status.communityUrl} className="sidebar-link" target="_blank" rel="noreferrer"><VkMark small />Сообщество ФМиИТ <ArrowUpRight size={16} /></a>{status.passwordRequired && <button type="button" className="sidebar-link logout-button" onClick={() => void action('logout', async () => { await api('/auth/logout', { method: 'POST' }); await initialize(); })}><LogOut size={16} />Выйти из студии</button>}<div className="sidebar-footer"><span className="sidebar-status-dot" />Для тех, кто создаёт будущее</div></div></aside>

    <div className="main-shell"><header className="topbar"><div className="breadcrumbs"><span>Контент-студия</span><ChevronRight size={14} /><strong>{pageName}</strong></div><div className="topbar-right"><span className="mode-badge"><Sparkles size={13} />{status.generationMode === 'ai' ? 'AI-редактор' : 'Демо-редактор'}</span><span className="topbar-divider" /><a href={status.communityUrl} className="topbar-avatar" target="_blank" rel="noreferrer" aria-label="Открыть сообщество ФМиИТ"><img src="/brand/avatar.jpg" alt="" width="32" height="32" /></a></div></header>
      <main id="main-content" className="main-content"><Suspense fallback={<div className="app-loading page-loading"><span className="spinner" /></div>}>
        {page === 'editor' && <><section className="editor-hero"><div className="hero-copy"><span className="eyebrow"><span />КОНТЕНТ С ХАРАКТЕРОМ ФМиИТ</span><h1>Ваши идеи.<br /><span>Наш общий голос.</span></h1><p>Превратите заметки в пост, который хочется читать.<br className="desktop-break" /> С текстом, обложкой и стилем вашего факультета.</p><div className="hero-chips"><span><CheckCircle2 size={13} />Фирменный стиль</span><span><CheckCircle2 size={13} />Публикация с подтверждением</span></div></div><OrbitalArt className="hero-art" /><div className="hero-index">МАТЕМАТИКА × ТЕХНОЛОГИИ</div></section><div className="editor-workspace-header"><div><h2>{active ? 'Продолжим вашу историю' : 'Начнём с идеи'}</h2><span>{active ? dirty ? 'Есть несохранённые правки' : active.status === 'published' ? 'Пост опубликован' : 'Черновик сохранён' : 'Вы задаёте смысл. Мы помогаем с формой.'}</span></div>{active && <button type="button" className="text-button" onClick={() => void newPost()} disabled={!!busy}><Plus size={16} />Новый пост</button>}</div><div className="editor-grid"><Editor key={active?.id ?? 'new'} draft={active} generating={!!busy} source={status.generationMode} onGenerate={generate} /><DraftPreview key={`preview-${active?.id ?? 'new'}`} draft={active} dirty={dirty} busy={!!busy} canPublish={status.canPublish} onEdit={edit} onSave={save} onDownload={download} onCopy={copy} onPublish={previewPublication} onConnect={() => setPage('settings')} /></div><div className="workspace-footnote"><span className="tiny-star">✳</span><span>Истории факультета — в руках тех, кто их создаёт.</span><a href={status.communityUrl} target="_blank" rel="noreferrer">ФМиИТ СФ УУНиТ <ExternalLink size={12} /></a></div></>}
        {page === 'library' && <Library drafts={drafts} onOpen={draft => void openDraft(draft)} onNew={() => void newPost()} />}
        {page === 'bot' && <BotDemo source={status.generationMode} onDraft={draft => void openDraft(draft)} onRefresh={refreshDrafts} />}
        {page === 'settings' && <Settings status={status} onRefresh={refreshStatus} busy={!!busy} />}
      </Suspense></main>
    </div>

    {notice && <div className={`toast ${notice.error ? 'toast-error' : ''}`} role={notice.error ? 'alert' : 'status'}>{notice.error ? <X size={18} /> : <CheckCircle2 size={18} />}<span>{notice.text}</span><button type="button" aria-label="Закрыть уведомление" onClick={() => setNotice(null)}><X size={16} /></button></div>}
    {confirmation && <PublishDialog draft={confirmation.draft} busy={!!busy} onCancel={() => setConfirmation(null)} onPublish={() => void publish()} />}
  </div>;
}
