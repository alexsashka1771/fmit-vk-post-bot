import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Bot, MessageCircle, Send } from 'lucide-react';
import { api, message } from '../api';
import type { BotReply, Draft } from '../../shared/contracts';
import { VkMark } from './Art';

type ChatMessage = { id: number; role: 'bot' | 'user'; text: string; coverId?: string; draft?: Draft };
type Props = { onDraft: (draft: Draft) => void; onRefresh: () => Promise<void>; source: 'ai' | 'demo' };

export default function BotDemo({ onDraft, onRefresh, source }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([{ id: 0, role: 'bot', text: 'Привет! Я редактор постов ФМиИТ 👋\n\nНажмите «Новый пост» или пришлите тему и факты командой «пост …». Подготовлю текст и обложку в стиле факультета.' }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [keyboard, setKeyboard] = useState([['Новый пост', 'Черновики'], ['Обложка', 'Помощь']]);
  const end = useRef<HTMLDivElement>(null);
  const id = useRef(1);
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' }); }, [messages, busy]);

  async function send(text: string) {
    if (!text.trim() || busy) return;
    setMessages(current => [...current, { id: id.current++, role: 'user', text: text.trim() }]);
    setInput(''); setBusy(true);
    try {
      const reply = await api<BotReply>('/chat-demo', { method: 'POST', body: JSON.stringify({ text }) });
      setMessages(current => [...current, { id: id.current++, role: 'bot', text: reply.text, ...(reply.attachCover && reply.draft ? { coverId: reply.draft.id } : {}), draft: reply.draft }]);
      if (reply.keyboard) setKeyboard(reply.keyboard);
      if (reply.draft) await onRefresh();
    } catch (error) { setMessages(current => [...current, { id: id.current++, role: 'bot', text: message(error) }]); }
    finally { setBusy(false); }
  }

  return <div className="bot-page"><div className="page-title-row"><div><span className="eyebrow">РЕДАКТОР В СООБЩЕНИЯХ</span><h1>Ваш помощник.<br />Прямо в диалоге.</h1><p>Попробуйте сценарий бота, прежде чем подключать ВК.</p></div><span className="big-page-icon"><MessageCircle size={48} strokeWidth={1.3} /></span></div>
    <div className="bot-layout"><section className="chat-window" aria-label="Симулятор диалога ВК-бота"><div className="chat-header"><img src="/brand/avatar.jpg" alt="" width="42" height="42" /><div><strong>ФМиИТ · Редактор</strong><span><span className="live-dot" />Симулятор · {source === 'demo' ? 'демо генерация' : 'нейросеть'}</span></div><VkMark /></div><div className="chat-messages" aria-live="polite" aria-relevant="additions"><div className="chat-day-label">Сегодня</div>{messages.map(item => <div key={item.id} className={`chat-message ${item.role}`}><p>{item.text}</p>{item.coverId && <img src={`/api/drafts/${item.coverId}/cover.png`} alt="Сгенерированная обложка" />}{item.draft && <button type="button" onClick={() => onDraft(item.draft!)} className="chat-open-draft">Открыть в редакторе <ArrowUpRight size={14} /></button>}</div>)}{busy && <div className="chat-message bot typing"><span /><span /><span /><span className="sr-only">Бот готовит ответ</span></div>}<div ref={end} /></div><div className="chat-keyboard">{keyboard.map((row, index) => <div key={index}>{row.map(label => <button type="button" key={label} onClick={() => void send(label)} disabled={busy}>{label}</button>)}</div>)}</div><form className="chat-input" onSubmit={event => { event.preventDefault(); void send(input); }}><input aria-label="Сообщение боту" placeholder="Написать сообщение…" value={input} onChange={event => setInput(event.target.value)} maxLength={8500} disabled={busy} /><button type="submit" aria-label="Отправить сообщение боту" disabled={busy || !input.trim()}><Send size={19} /></button></form></section>
      <aside className="bot-guide"><span className="guide-icon"><Bot size={27} /></span><h2>От заметки<br />до готового поста</h2><ol><li><span>1</span><div><strong>Опишите событие</strong><p>Тема, проверенные факты и всё, что нужно рассказать.</p></div></li><li><span>2</span><div><strong>Получите текст и обложку</strong><p>Откройте редактор или поправьте текст прямо в чате.</p></div></li><li><span>3</span><div><strong>Проверьте и подтвердите</strong><p>В подключённом ВК-боте публикация требует вашего подтверждения.</p></div></li></ol><div className="bot-demo-note">Здесь создаются настоящие черновики. Симулятор не отправляет сообщения и посты во ВК.</div><button type="button" className="text-button" onClick={() => setInput('пост Лекция по информационным технологиям. 28 ноября в 15:00, аудитория 301.')}>Вставить пример <ArrowUpRight size={15} /></button></aside>
    </div></div>;
}
