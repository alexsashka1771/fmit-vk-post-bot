import { useEffect, useRef } from 'react';
import { ArrowRight, X } from 'lucide-react';
import type { Draft } from '../../shared/contracts';

type Props = { draft: Draft; busy: boolean; onCancel: () => void; onPublish: () => void };

export default function PublishDialog({ draft, busy, onCancel, onPublish }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => { if (dialog?.open) dialog.close(); }; }, []);
  return <dialog ref={ref} className="publish-modal" aria-labelledby="publish-title" onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }}>
    <button type="button" className="modal-close icon-button" aria-label="Отменить публикацию" onClick={onCancel} disabled={busy}><X size={20} /></button>
    <span className="eyebrow">ПОСЛЕДНЯЯ ПРОВЕРКА</span><h2 id="publish-title">Готовы поделиться<br />с факультетом?</h2><p>Этот текст и обложка появятся на стене сообщества ФМиИТ.</p>
    {draft.publicationError && <div className="publication-warning">{draft.publicationError}</div>}
    <img src={`/api/drafts/${draft.id}/cover.png?v=${draft.revision}`} alt="Обложка для публикации" />
    <div className="publication-copy"><strong>{draft.title}</strong><p>{draft.body}</p><span>{draft.hashtags.join(' ')}</span></div>
    <div className="modal-actions"><button type="button" className="button button-outline" onClick={onCancel} disabled={busy} autoFocus>Ещё проверю</button><button type="button" className="button button-primary" onClick={onPublish} disabled={busy}>{busy ? <span className="spinner" /> : <>Да, опубликовать<ArrowRight size={16} /></>}</button></div>
  </dialog>;
}
