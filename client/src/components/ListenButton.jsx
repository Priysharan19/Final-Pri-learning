// Pri Learning · "Listen" control (F9). Reads a worked step or a tutor reply
// aloud with an on-device voice (explain/listen.js). Hidden when the device has
// no usable voice; nothing goes over the network.
import React, { useEffect, useRef, useState } from 'react';
import { listenPlan, listenText } from '../explain/listen.js';
import { useLanguage } from '../i18n/index.js';

const synth = () => (typeof window !== 'undefined' && 'speechSynthesis' in window
  && typeof SpeechSynthesisUtterance !== 'undefined' ? window.speechSynthesis : null);

function useVoices() {
  const [voices, setVoices] = useState(() => synth()?.getVoices?.() || []);
  useEffect(() => {
    const s = synth();
    if (!s) return undefined;
    const update = () => setVoices(s.getVoices?.() || []);
    update();
    s.addEventListener?.('voiceschanged', update);
    return () => s.removeEventListener?.('voiceschanged', update);
  }, []);
  return voices;
}

export default function ListenButton({ text, region, className = 'btn btn-ghost btn-sm no-print' }) {
  const { t, language } = useLanguage();
  const voices = useVoices();
  const [speaking, setSpeaking] = useState(false);
  const live = useRef(null);
  useEffect(() => () => { if (live.current) synth()?.cancel(); }, []);

  const plan = synth() ? listenPlan(voices, language, { region }) : null;
  const words = listenText(text, plan);
  if (!plan || !words) return null;

  const stop = () => { live.current = null; synth()?.cancel(); setSpeaking(false); };
  const play = () => {
    const s = synth();
    s.cancel();
    const u = new SpeechSynthesisUtterance(words);
    u.lang = plan.lang;
    u.voice = plan.voice;
    u.rate = 0.95;
    u.onend = u.onerror = () => { if (live.current === u) { live.current = null; setSpeaking(false); } };
    live.current = u;
    setSpeaking(true);
    s.speak(u);
  };
  return (
    <button type="button" className={className} data-listen={speaking ? 'speaking' : 'idle'}
      aria-pressed={speaking} onClick={speaking ? stop : play}>
      {speaking ? t('listen.stop') : t('listen.play')}
    </button>
  );
}
