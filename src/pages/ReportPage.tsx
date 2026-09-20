import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Type, Mic, MicOff, FileText, MapPin, Tag, Send, ArrowLeft, AlertCircle, Loader2, Check } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { CATEGORIES } from '@/lib/types';
import type { Category } from '@/lib/types';
import { COUNTRY_LIST, COUNTRY_STATES } from '@/lib/countries';
import { addComplaint, getOrCreatePseudonymousId } from '@/lib/data';
import { getCategoryLabel } from '@/lib/translations';

type Mode = 'text' | 'voice';

const SPEECH_LANG_MAP: Record<string, string> = {
  en: 'en-US',
  hi: 'hi-IN',
  zh: 'zh-CN',
  pt: 'pt-BR',
  ru: 'ru-RU',
  zu: 'zu-ZA',
  ar: 'ar-SA',
  fa: 'fa-IR',
  am: 'am-ET',
};

export function ReportPage() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>('text');
  const [submitting, setSubmitting] = useState(false);

  // Text mode fields
  const [category, setCategory] = useState<Category | ''>('');
  const [description, setDescription] = useState('');
  const [country, setCountry] = useState<string>('');
  const [stateProv, setStateProv] = useState<string>('');
  const [district, setDistrict] = useState('');

  // Voice mode fields
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [voiceSubmitted, setVoiceSubmitted] = useState(false);
  const [voiceCategory, setVoiceCategory] = useState<Category>('Other');
  const [voiceCountry, setVoiceCountry] = useState<string>('');
  const [voiceState, setVoiceState] = useState<string>('');
  const [voiceDistrict, setVoiceDistrict] = useState('');
  const [voiceSummary, setVoiceSummary] = useState('');
  const recognitionRef = useRef<WebSpeechRecognition | null>(null);

  const speechSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const states = country ? COUNTRY_STATES[country as keyof typeof COUNTRY_STATES] || [] : [];
  const voiceStates = voiceCountry ? COUNTRY_STATES[voiceCountry as keyof typeof COUNTRY_STATES] || [] : [];

  const buildLocation = (dist: string, st: string, ctry: string): string => {
    const parts = [dist, st, ctry].filter(Boolean);
    return parts.join(', ');
  };

  const handleSubmitText = async () => {
    if (!category || !description || !country || !stateProv) return;
    setSubmitting(true);
    try {
      const location = buildLocation(district, stateProv, country);
      const pseudoId = getOrCreatePseudonymousId();
      const id = await addComplaint({
        category,
        location,
        issue_summary: description,
        transcript: null,
        language,
        pseudonymous_id: pseudoId,
        verification_status: 'needs_review',
        priority_score: 0,
      });
      // Store the last submission for the confirmation page
      sessionStorage.setItem('pledoc_last_complaint', JSON.stringify({
        id, category, location,
      }));
      navigate('/confirmation');
    } catch {
      setSubmitting(false);
    }
  };

  const startRecording = () => {
    if (!speechSupported) return;
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.lang = SPEECH_LANG_MAP[language] || 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event: WebSpeechRecognitionEvent) => {
      let final = '';
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        }
      }
      if (final) {
        setTranscript((prev) => (prev + ' ' + final).trim());
      }
    };
    recognition.onend = () => {
      setIsRecording(false);
    };
    recognition.onerror = () => {
      setIsRecording(false);
    };
    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    recognitionRef.current?.stop();
    setIsRecording(false);
  };

  // Extract fields from transcript — simple keyword-based heuristic
  // NOTE: In production, this will be replaced by Gemini API NLP extraction (backend responsibility)
  const extractFieldsFromTranscript = (text: string) => {
    const lower = text.toLowerCase();
    const cats: Category[] = ['Water', 'Roads', 'Electricity', 'Sanitation', 'Other'];
    let detectedCat: Category = 'Other';
    for (const cat of cats) {
      const catLabel = getCategoryLabel(cat, language).toLowerCase();
      if (lower.includes(cat.toLowerCase()) || lower.includes(catLabel)) {
        detectedCat = cat;
        break;
      }
    }
    // Try to detect country
    for (const c of COUNTRY_LIST) {
      if (lower.includes(c.toLowerCase())) {
        setVoiceCountry(c);
        break;
      }
    }
    setVoiceCategory(detectedCat);
    setVoiceSummary(text.substring(0, 200));
  };

  useEffect(() => {
    if (voiceSubmitted && transcript) {
      extractFieldsFromTranscript(transcript);
    }
  }, [voiceSubmitted]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleVoiceConfirm = async () => {
    if (!voiceCategory || !voiceSummary || !voiceCountry) return;
    setSubmitting(true);
    try {
      const location = buildLocation(voiceDistrict, voiceState, voiceCountry);
      const pseudoId = getOrCreatePseudonymousId();
      const id = await addComplaint({
        category: voiceCategory,
        location,
        issue_summary: voiceSummary,
        transcript,
        language,
        pseudonymous_id: pseudoId,
        verification_status: 'needs_review',
        priority_score: 0,
      });
      sessionStorage.setItem('pledoc_last_complaint', JSON.stringify({
        id, category: voiceCategory, location,
      }));
      navigate('/confirmation');
    } catch {
      setSubmitting(false);
    }
  };

  const resetVoice = () => {
    setTranscript('');
    setVoiceSubmitted(false);
    setVoiceCategory('Other');
    setVoiceCountry('');
    setVoiceState('');
    setVoiceDistrict('');
    setVoiceSummary('');
  };

  const textReady = category && description.trim() && country && stateProv;
  const voiceReady = voiceCategory && voiceSummary.trim() && voiceCountry;

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <button
        onClick={() => navigate('/home')}
        className="inline-flex items-center gap-1.5 text-sm text-ink-400 hover:text-ink-700 transition-colors mb-5"
      >
        <ArrowLeft className="w-4 h-4" />
        {t.backHome}
      </button>

      <h1 className="text-2xl font-bold text-ink-900 mb-1">{t.reportTitle}</h1>
      <p className="text-ink-400 text-sm mb-6">{t.reportSub}</p>

      {/* Mode toggle */}
      <div className="flex gap-2 p-1 bg-cream-200 rounded-xl mb-6 w-fit">
        <button
          onClick={() => setMode('text')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${mode === 'text'
            ? 'bg-surface-50 text-citizen-700 shadow-soft'
            : 'text-ink-500 hover:text-ink-700'
            }`}
        >
          <Type className="w-4 h-4" />
          {t.textMode}
        </button>
        <button
          onClick={() => setMode('voice')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${mode === 'voice'
            ? 'bg-surface-50 text-data-700 shadow-soft'
            : 'text-ink-500 hover:text-ink-700'
            }`}
        >
          <Mic className="w-4 h-4" />
          {t.voiceMode}
        </button>
      </div>

      {/* Text Mode */}
      {mode === 'text' && (
        <div className="card p-6 space-y-5 animate-scale-in">
          {/* Category */}
          <div>
            <label className="label flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-ink-400" />
              {t.category}
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
              className="input"
            >
              <option value="">{t.selectCategory}</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {getCategoryLabel(cat, language)}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="label flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-ink-400" />
              {t.description}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t.descriptionPlaceholder}
              rows={4}
              className="input resize-none"
            />
          </div>

          {/* Location fields */}
          <div className="pt-2 border-t border-cream-300/60">
            <label className="label flex items-center gap-1.5 mb-3">
              <MapPin className="w-3.5 h-3.5 text-ink-400" />
              {t.country}
            </label>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <select
                  value={country}
                  onChange={(e) => {
                    setCountry(e.target.value);
                    setStateProv('');
                  }}
                  className="input"
                >
                  <option value="">{t.selectCountry}</option>
                  {COUNTRY_LIST.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <select
                  value={stateProv}
                  onChange={(e) => setStateProv(e.target.value)}
                  disabled={!country}
                  className="input disabled:opacity-50"
                >
                  <option value="">{t.selectState}</option>
                  {states.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-4">
              <input
                type="text"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                placeholder={t.districtPlaceholder}
                className="input"
              />
              <p className="text-xs text-ink-400 mt-1.5">{t.districtLocality}</p>
            </div>
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmitText}
            disabled={!textReady || submitting}
            className="btn btn-citizen w-full"
          >
            {submitting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> {t.submitting}</>
            ) : (
              <><Send className="w-4 h-4" /> {t.submit}</>
            )}
          </button>
        </div>
      )}

      {/* Voice Mode */}
      {mode === 'voice' && (
        <div className="card p-6 animate-scale-in">
          {!speechSupported && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-decision-100 text-decision-800 mb-5">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p className="text-sm font-medium">{t.voiceNotSupported}</p>
            </div>
          )}

          {speechSupported && !voiceSubmitted && (
            <div className="flex flex-col items-center py-8">
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`w-24 h-24 rounded-full flex items-center justify-center shadow-soft-lg transition-all hover:scale-105 ${isRecording
                  ? 'bg-decision-700 animate-pulse-soft'
                  : 'bg-data-700 hover:bg-data-800'
                  }`}
              >
                {isRecording ? (
                  <MicOff className="w-10 h-10 text-white" />
                ) : (
                  <Mic className="w-10 h-10 text-white" />
                )}
              </button>
              <p className="mt-4 text-sm font-medium text-ink-600">
                {isRecording ? t.recording : t.tapToRecord}
              </p>

              {transcript && (
                <div className="w-full mt-6">
                  <label className="label">{t.liveTranscript}</label>
                  <div className="p-4 rounded-xl bg-cream-200 border border-cream-300/60 text-sm text-ink-700 min-h-[80px] max-h-[200px] overflow-y-auto">
                    {transcript}
                  </div>
                  {!isRecording && transcript && (
                    <button
                      onClick={() => setVoiceSubmitted(true)}
                      className="btn btn-data w-full mt-4"
                    >
                      <Check className="w-4 h-4" /> {t.confirmSubmit}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {voiceSubmitted && (
            <div className="space-y-5 animate-fade-in-up">
              {/* Transcript preview */}
              <div>
                <label className="label">{t.transcriptPreview}</label>
                <div className="p-4 rounded-xl bg-cream-200 border border-cream-300/60 text-sm text-ink-700 max-h-[150px] overflow-y-auto">
                  {transcript}
                </div>
              </div>

              <div className="pt-2 border-t border-cream-300/60">
                <p className="label">{t.extractedFields}</p>
              </div>

              {/* Extracted category */}
              <div>
                <label className="label flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-ink-400" />
                  {t.category}
                </label>
                <select
                  value={voiceCategory}
                  onChange={(e) => setVoiceCategory(e.target.value as Category)}
                  className="input"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {getCategoryLabel(cat, language)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Extracted summary */}
              <div>
                <label className="label flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-ink-400" />
                  {t.description}
                </label>
                <textarea
                  value={voiceSummary}
                  onChange={(e) => setVoiceSummary(e.target.value)}
                  rows={3}
                  className="input resize-none"
                />
              </div>

              {/* Location */}
              <div>
                <label className="label flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-ink-400" />
                  {t.country}
                </label>
                <div className="grid sm:grid-cols-2 gap-4">
                  <select
                    value={voiceCountry}
                    onChange={(e) => {
                      setVoiceCountry(e.target.value);
                      setVoiceState('');
                    }}
                    className="input"
                  >
                    <option value="">{t.selectCountry}</option>
                    {COUNTRY_LIST.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <select
                    value={voiceState}
                    onChange={(e) => setVoiceState(e.target.value)}
                    disabled={!voiceCountry}
                    className="input disabled:opacity-50"
                  >
                    <option value="">{t.selectState}</option>
                    {voiceStates.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="mt-4">
                  <input
                    type="text"
                    value={voiceDistrict}
                    onChange={(e) => setVoiceDistrict(e.target.value)}
                    placeholder={t.districtPlaceholder}
                    className="input"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={resetVoice}
                  className="btn btn-outline flex-1"
                  disabled={submitting}
                >
                  {t.reRecord}
                </button>
                <button
                  onClick={handleVoiceConfirm}
                  disabled={!voiceReady || submitting}
                  className="btn btn-citizen flex-1"
                >
                  {submitting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> {t.submitting}</>
                  ) : (
                    <><Send className="w-4 h-4" /> {t.confirmSubmit}</>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
