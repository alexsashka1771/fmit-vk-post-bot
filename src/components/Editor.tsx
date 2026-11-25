import { useState } from 'react';
import { ArrowUpRight, ChevronDown, Clock3, Lightbulb, Sparkles } from 'lucide-react';
import { categories, initialBrief, lengths, tones } from '../../shared/contracts';
import type { Brief, Draft } from '../../shared/contracts';

type Props = { draft: Draft | null; generating: boolean; source: 'ai' | 'demo'; onGenerate: (brief: Brief) => Promise<void> };

export default function Editor({ draft, generating, source, onGenerate }: Props) {
  const [brief, setBrief] = useState<Brief>(draft ? { ...draft.brief, coverStyle: draft.coverStyle } : initialBrief);
  const [validation, setValidation] = useState('');
  const set = <K extends keyof Brief>(key: K, value: Brief[K]) => { setBrief(previous => ({ ...previous, [key]: value })); setValidation(''); };

  function template(kind: 'event' | 'news' | 'science') {
    const data = kind === 'science' ? { topic: 'Лекция «Музыка и мозг»', facts: '23 ноября студенты ФМиИТ вместе с деканом и заведующим кафедрой прикладной информатики и программирования посетили научно-популярную лекцию «Музыка и мозг» в Геномном центре Межвузовского кампуса Евразийского НОЦ в Уфе. Спикер — Алексей Паевский. Обсудили восприятие звука, ритм и мелодию, влияние музыки на мозг.' } : kind === 'news' ? { topic: 'Новость о студенческом проекте', facts: '' } : { topic: 'Анонс встречи студенческого клуба', facts: '' };
    setBrief(previous => ({ ...previous, ...data, category: kind })); setValidation('');
  }

  return <section className="panel brief-panel" aria-labelledby="brief-heading">
    <div className="panel-heading"><div><span className="step-number">01</span><h2 id="brief-heading">О чём расскажем?</h2></div><span className="muted panel-step">Ваша идея</span></div>
    <form onSubmit={event => { event.preventDefault(); if (brief.topic.trim().length < 3) { setValidation('Напишите тему поста — хотя бы три символа.'); return; } void onGenerate(brief); }}>
      <label className="field-label" htmlFor="topic">Тема поста <span className="required-dot">*</span></label>
      <textarea id="topic" className="topic-input" value={brief.topic} onChange={event => set('topic', event.target.value)} maxLength={300} rows={2} placeholder="Например, день открытых дверей на ФМиИТ" aria-invalid={!!validation} aria-describedby={validation ? 'topic-error' : undefined} disabled={generating} />
      {validation && <p id="topic-error" className="field-error" role="alert">{validation}</p>}
      <div className="idea-chips" aria-label="Идеи для поста"><button type="button" onClick={() => template('event')} disabled={generating}>+ Анонс</button><button type="button" onClick={() => template('news')} disabled={generating}>+ Новость</button><button type="button" onClick={() => template('science')} disabled={generating}>+ Научная история</button></div>

      <div className="field-label-row"><label className="field-label" htmlFor="facts">Факты и детали</label><span className="optional-label">Если есть</span></div>
      <textarea id="facts" value={brief.facts} onChange={event => set('facts', event.target.value)} maxLength={8000} rows={4} placeholder="Что, когда и где? Участники, важные подробности, ссылка на регистрацию. Можно вставить свои заметки." disabled={generating} />
      <p className="field-hint">Точные факты помогут сделать пост полезнее.</p>

      <div className="form-pair">
        <div><label className="field-label" htmlFor="category">Формат</label><div className="select-wrap"><select id="category" value={brief.category} onChange={event => set('category', event.target.value as Brief['category'])} disabled={generating}>{Object.entries(categories).map(([key, category]) => <option key={key} value={key}>{category.label}</option>)}</select><ChevronDown size={15} /></div></div>
        <div><label className="field-label" htmlFor="tone">Тон общения</label><div className="select-wrap"><select id="tone" value={brief.tone} onChange={event => set('tone', event.target.value as Brief['tone'])} disabled={generating}>{Object.entries(tones).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><ChevronDown size={15} /></div></div>
      </div>

      <label className="field-label length-label" id="length-label">Длина поста</label>
      <div className="segmented length-options" role="group" aria-labelledby="length-label">{Object.entries(lengths).map(([key, label]) => <button key={key} type="button" aria-pressed={brief.length === key} className={brief.length === key ? 'selected' : ''} onClick={() => set('length', key as Brief['length'])} disabled={generating}>{label}</button>)}</div>

      <div className="editor-note"><Lightbulb size={17} /><p>Стиль факультета и фирменные хештеги уже учтены.</p></div>
      <button type="submit" className="button button-primary generate-button" disabled={generating}>{generating ? <><span className="spinner" />Готовим ваш пост…</> : <><Sparkles size={18} />{draft ? 'Создать ещё вариант' : 'Создать пост'}<ArrowUpRight size={19} className="button-end" /></>}</button>
      <div className="generation-footnote"><Clock3 size={12} />{source === 'demo' ? 'Демо: генерация по шаблону' : 'Генерация с помощью нейросети'}</div>
    </form>
  </section>;
}
