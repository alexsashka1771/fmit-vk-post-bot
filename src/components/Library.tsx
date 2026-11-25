import { useState } from 'react';
import { ArrowUpRight, FileText, Plus, Search } from 'lucide-react';
import { categories } from '../../shared/contracts';
import type { Draft } from '../../shared/contracts';

type Props = { drafts: Draft[]; onOpen: (draft: Draft) => void; onNew: () => void };

export default function Library({ drafts, onOpen, onNew }: Props) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'draft' | 'published'>('all');
  const filtered = drafts.filter(draft => (filter === 'all' || filter === 'draft' && draft.status !== 'published' || draft.status === filter) && `${draft.title} ${draft.body}`.toLocaleLowerCase('ru').includes(search.toLocaleLowerCase('ru')));
  return <div className="library-page">
    <div className="page-title-row"><div><span className="eyebrow">ВАШ КОНТЕНТ</span><h1>Истории, которые<br />вы сохранили.</h1><p>Все варианты под рукой. Продолжите с любого.</p></div><button type="button" className="button button-primary" onClick={onNew}><Plus size={17} />Новый пост</button></div>
    <div className="library-toolbar"><div className="segmented" role="group" aria-label="Статус постов">{([['all', 'Все'], ['draft', 'Черновики'], ['published', 'Опубликованные']] as const).map(([key, label]) => <button type="button" key={key} className={filter === key ? 'selected' : ''} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>)}</div><div className="search-wrap"><Search size={17} /><input aria-label="Поиск по черновикам" placeholder="Найти пост" value={search} onChange={event => setSearch(event.target.value)} /></div></div>
    {filtered.length ? <div className="draft-grid">{filtered.map(draft => <button type="button" className="draft-card" key={draft.id} onClick={() => onOpen(draft)}><img src={`/api/drafts/${draft.id}/cover.png?v=${draft.revision}`} alt="" loading="lazy" /><div className="draft-card-body"><div className="draft-card-meta"><span>{categories[draft.brief.category].label}</span><span className={`draft-status ${draft.status}`}>{draft.status === 'published' ? 'Опубликован' : draft.status === 'publishing' ? 'Публикуется' : draft.status === 'uncertain' ? 'Нужна проверка' : 'Черновик'}</span></div><h2>{draft.title}</h2><div className="draft-card-footer"><span>{new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'short' }).format(new Date(draft.createdAt))} · {draft.source === 'ai' ? 'Нейросеть' : 'Демо'}</span><ArrowUpRight size={18} /></div></div></button>)}</div> : <div className="empty-library"><span className="empty-icon"><FileText size={34} strokeWidth={1.4} /></span><h2>{drafts.length ? 'Ничего не нашлось' : 'Первая история ещё впереди'}</h2><p>{drafts.length ? 'Попробуйте другую тему или смените фильтр.' : 'Создайте пост — он сохранится здесь автоматически.'}</p>{!drafts.length && <button type="button" className="button button-primary" onClick={onNew}><Plus size={16} />Создать первый пост</button>}</div>}
  </div>;
}
