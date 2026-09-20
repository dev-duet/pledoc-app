export type VerificationStatus = 'needs_review' | 'verified' | 'invalid';

export type Category = 'Water' | 'Roads' | 'Electricity' | 'Sanitation' | 'Other';

export interface Complaint {
  id: string;
  category: string;
  location: string;
  issue_summary: string;
  transcript: string | null;
  language: string;
  pseudonymous_id: string;
  verification_status: VerificationStatus;
  priority_score: number;
  cluster_id?: string | null;
  created_at: number;
}

export interface Cluster {
  id: string;
  category: string;
  location_bucket: string;
  count: number;
  verification_status: VerificationStatus;
  priority_score: number;
  country: string;
}

export type LanguageCode =
  | 'en'
  | 'hi'
  | 'zh'
  | 'pt'
  | 'ru'
  | 'zu'
  | 'ar'
  | 'fa'
  | 'am';

export interface LanguageMeta {
  code: LanguageCode;
  nativeName: string;
  englishName: string;
  flag: string;
  primary: boolean;
}

export const LANGUAGES: LanguageMeta[] = [
  { code: 'en', nativeName: 'English', englishName: 'English', flag: '🇬🇧', primary: true },
  { code: 'hi', nativeName: 'हिन्दी', englishName: 'Hindi', flag: '🇮🇳', primary: true },
  { code: 'zh', nativeName: '中文', englishName: 'Mandarin Chinese', flag: '🇨🇳', primary: true },
  { code: 'pt', nativeName: 'Português', englishName: 'Portuguese', flag: '🇧🇷', primary: true },
  { code: 'ru', nativeName: 'Русский', englishName: 'Russian', flag: '🇷🇺', primary: true },
  { code: 'zu', nativeName: 'isiZulu', englishName: 'Zulu', flag: '🇿🇦', primary: true },
  { code: 'ar', nativeName: 'العربية', englishName: 'Arabic', flag: '🇸🇦', primary: false },
  { code: 'fa', nativeName: 'فارسی', englishName: 'Persian', flag: '🇮🇷', primary: false },
  { code: 'am', nativeName: 'አማርኛ', englishName: 'Amharic', flag: '🇪🇹', primary: false },
];

export const CATEGORIES: Category[] = ['Water', 'Roads', 'Electricity', 'Sanitation', 'Other'];
