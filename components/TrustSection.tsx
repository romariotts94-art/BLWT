'use client';

import React, {useEffect, useRef, useState} from 'react';
import {ArrowRight, BookUser, Check, MessageCircle, RefreshCw, Sparkles, Star} from 'lucide-react';
import {demoCleaners} from '../lib/demo-cleaners';

export function experienceLabel(n: number) {
  const ten = n % 10, hundred = n % 100;
  return `${n} ${hundred >= 11 && hundred <= 14 ? 'лет' : ten === 1 ? 'год' : ten >= 2 && ten <= 4 ? 'года' : 'лет'} опыта`;
}

function WelcomeMark() {
  return <span className="trust-welcome-mark" aria-hidden="true">
    <svg viewBox="0 0 48 48" fill="none">
      <path d="M12 36V20a12 12 0 0 1 24 0v16" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M18 36V20a6 6 0 0 1 12 0v16" fill="currentColor" opacity=".13"/>
      <path d="M20 36V18l10-3v24l-10-3Z" fill="currentColor"/>
      <path d="M9 36h11m10 0h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="26.5" cy="27" r="1.1" fill="#e7d6a3"/>
    </svg>
  </span>;
}

export default function TrustSection({onBook}: {onBook: () => void}) {
  const [cards, setCards] = useState<any[]>([]);
  const [demo, setDemo] = useState(false);
  const carousel = useRef<HTMLDivElement>(null);
  const resumeAt = useRef(0);
  const interacting = useRef(false);

  useEffect(() => {
    const section = document.getElementById('cleaners');
    if (!section) return;
    const observer = new IntersectionObserver(([entry]) => {
      document.body.classList.toggle('viewing-cleaners', entry.isIntersecting);
    }, {rootMargin: '-20% 0px -15% 0px'});
    observer.observe(section);
    return () => { observer.disconnect(); document.body.classList.remove('viewing-cleaners'); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/cleaners/public')
      .then(async response => {
        if (!response.ok) throw Error();
        return response.json();
      })
      .then((data: any) => {
        if (!cancelled) {
          setCards(data.cards || []);
          setDemo(data.demo === true);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const displayed = demo
    ? demoCleaners.map((example, index) => cards.find(card => card.position === index) || example)
    : cards;

  const goToSlide = (index: number) => {
    const el = carousel.current;
    if (!el || !el.children[index]) return;
    const first = el.children[0] as HTMLElement;
    const next = el.children[index] as HTMLElement;
    el.scrollTo({left: next.offsetLeft - first.offsetLeft, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
  };
  useEffect(() => {
    if (displayed.length < 2) return;
    const timer = window.setInterval(() => {
      const el = carousel.current;
      if (!el || interacting.current || el.contains(document.activeElement) || document.hidden || Date.now() < resumeAt.current || !window.matchMedia('(max-width: 700px)').matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const rect = el.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) return;
      const first = el.children[0] as HTMLElement;
      const second = el.children[1] as HTMLElement;
      const step = second.offsetLeft - first.offsetLeft;
      const index = Math.round(el.scrollLeft / step);
      goToSlide((index + 1) % displayed.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [displayed.length]);

  return <section id="cleaners" className="trust-section" aria-labelledby="trust-title">
    <div className="trust-heading-top">
      <WelcomeMark/>
      <span className="eyebrow">СПОКОЙНО ЗА СВОЙ ДОМ</span>
    </div>
    <div className="trust-heading">
      <h2 id="trust-title">Сначала знакомитесь<br/><em>Потом открываете дверь</em></h2>
      <p>Ещё до уборки вы знаете, кто приедет. Фото, опыт и результаты проверок — в анкете. Пожелания и важные детали — в личном чате.</p>
    </div>
    {displayed.length > 0 && <>
      <div className="trust-cards-heading">
        <h3>Познакомьтесь с исполнителями</h3>
        <span><MessageCircle size={16} strokeWidth={1.5} aria-hidden="true"/> Всё можно обсудить до встречи</span>
      </div>
      <div className="trust-cards" ref={carousel} data-count={displayed.length}
        onPointerDown={() => { interacting.current = true; resumeAt.current = Date.now() + 12000; }}
        onPointerUp={() => { interacting.current = false; resumeAt.current = Date.now() + 12000; }}
        onPointerCancel={() => { interacting.current = false; resumeAt.current = Date.now() + 12000; }}
        onTouchEnd={() => { interacting.current = false; resumeAt.current = Date.now() + 12000; }}
      >
        {displayed.map(card => {
          const href = '/cleaners/' + encodeURIComponent(card.id);
          const checked = !(card.demo || card.preview);
          return <article className="trust-card" key={card.id}>
            <div className="trust-portrait">
              <a className="trust-portrait-link" href={href} aria-label={'Открыть анкету: ' + card.name}>
                <img src={card.avatar} alt={card.name} width="640" height="640" loading="lazy" data-framing={card.portraitFraming || 'standard'}/>
              </a>
            </div>
            <div className="trust-card-body">
              <div className="trust-card-name">
                <h3>{card.name}</h3>
                {card.reviews?.length > 0 && <span className="trust-rating" aria-label={`Оценка ${card.rating}, отзывов: ${card.reviews.length}`}>
                  <Star size={15} fill="currentColor" aria-hidden="true"/>{card.rating} <small>({card.reviews.length})</small>
                </span>}
              </div>
              <div className="trust-card-meta">{card.age && <span>{card.age} года</span>}<span>{experienceLabel(card.experienceYears)}</span><span>{card.city || 'Москва'}</span></div>
              <p className="trust-specialty">{card.specialties || 'Уборка квартир и домов'}</p>
              <div className="trust-checks">
                <div><BookUser size={18} strokeWidth={1.5} aria-hidden="true"/><span>{checked ? 'Паспорт проверен' : 'Проверка паспорта'}</span>{checked && <Check size={15} aria-hidden="true"/>}</div>
                <div>{checked ? <Sparkles size={18} strokeWidth={1.5} aria-hidden="true"/> : <MessageCircle size={18} strokeWidth={1.5} aria-hidden="true"/>}<span>{checked ? 'Опыт подтверждён' : 'Знакомство в чате'}</span>{checked && <Check size={15} aria-hidden="true"/>}</div>
              </div>
              <a className="trust-card-link" href={href}>Познакомиться</a>
            </div>
          </article>;
        })}
      </div>

    </>}
    <ol className="trust-story" aria-label="От заказа до знакомства">
      <li><span className="trust-step" aria-hidden="true">01</span><div><h3>Знаете, кто приедет</h3><p>Первый подходящий исполнитель принимает заказ — вы видите его анкету.</p></div></li>
      <li><span className="trust-step" aria-hidden="true">02</span><div><h3>Знакомитесь заранее</h3><p>Смотрите проверки и обсуждаете в чате всё, что важно для вашего дома.</p></div></li>
      <li><span className="trust-step" aria-hidden="true">03</span><div><h3>Можете попросить замену</h3><p>Если исполнитель не подошёл, до начала уборки можно запустить новый подбор.</p></div></li>
    </ol>
    <div className="trust-bottom">
      <div className="trust-choice"><RefreshCw size={21} strokeWidth={1.5} aria-hidden="true"/><p>При замене доступность другого исполнителя на выбранное время нужно будет подтвердить.</p></div>
      <button className="btn accent" onClick={onBook}>Рассчитать уборку <ArrowRight size={19} aria-hidden="true"/></button>
    </div>
  </section>;
}
