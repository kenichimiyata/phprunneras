// src/pages/Home.tsx

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from '@google/genai';
import React, { useState, useEffect, useRef, FormEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import supabase, { getPrompts, upsertPrompt, deletePrompt, getUserActivePromptId, updateUserActivePrompt, getPromptContent, saveAnswerToSupabase, insertChatMessage, sendWebRTCSignal, uploadFileAndGetUrl, Prompt, getUserSettings, upsertUserSettings, UserSettings, invokeYoutubeTranscript, getDemoQuestions, DemoQuestion, upsertDemoQuestion, deleteDemoQuestion, getKnowledgeBaseEntries, upsertKnowledgeBaseEntry, deleteKnowledgeBaseEntry, KnowledgeBaseEntry } from './supabaseClient';

// D-ID SDKのインポート
import * as DidSdk from '@d-id/client-sdk';


import {
  AppBar, Box, Button, Chip, Container, createTheme, CssBaseline, Fab,
  IconButton, Paper, TextField, ThemeProvider, Toolbar, Typography, Avatar,
  CircularProgress, Alert, Link, FormControlLabel, Switch, Stack, Grow, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, DialogContentText, Snackbar,
  List, ListItem, ListItemButton, ListItemIcon, ListItemText, ListItemSecondaryAction, Divider, Tabs, Tab, Slider,
  FormControl, InputLabel, Select, MenuItem, ToggleButton, ToggleButtonGroup
} from '@mui/material';
import { deepOrange } from '@mui/material/colors';
import { Send, AttachFile, Close, VolumeUp, Person, InfoOutlined, Search, Videocam, ScreenShare, CallEnd, Mic, MicOff, LockOutlined, CameraAlt, Image as ImageIcon, Screenshot, Settings, Add, Delete, CheckCircle, Edit, YouTube, VolumeOff, Forum, SmartToy, AutoAwesome, Sync, Movie } from '@mui/icons-material';
import AiCharacter from './components/AiCharacter';

const MODEL_NAME = 'gemini-2.5-flash';
// Fix: Per coding guidelines, the API key MUST be obtained from process.env.API_KEY.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });


// ！！！重要！！！
// 以下の 'YOUR_D-ID_API_KEY' を、ご自身の有効なD-ID Client API Keyに置き換えてください。
// "Failed to fetch" エラーの主な原因は、キーが無効であるか、
// このページをホストしているドメイン (例: http://localhost:5173) が
// D-IDプロジェクト設定で「許可されたドメイン」として登録されていないことです。
const D_ID_CLIENT_KEY = 'Z29vZ2xlLW9hdXRoMnwxMDkwMTUzMTg3Njc3NTE5NzI5MTY6MXhjSFptOXM5NjF3WmYtUVVrRk1Q';
const D_ID_AGENT_ID = 'v2_agt_O1UCkce7'; // 適切なAgent IDに置き換えてください

const DEFAULT_SYSTEM_PROMPT = {
    title: 'デフォルトの査定員プロンプト',
    content: 'あなたは「AI査定員」です。ブランド品買取「リファスタ」のAIアシスタントです。提供された検索結果（kinkaimasu.jp　https://sites.google.com/view/loungenr/%E3%83%9B%E3%83%BC%E3%83%A0　からの情報）を最優先で利用し、お客様からのお品物（貴金属、ダイヤモンド、ブランド品など）の査定に関する質問に、丁寧でプロフェッショナルな口調で日本語で答えます。回答にはMarkdown形式を積極的に使用して、リストや強調などを用いて情報を分かりやすく整理してください。画像が提供された場合はそれを分析し、専門知識に基づいて回答してください。査定額を提示する際は、必ず「あくまで概算であり、実物査定で変動する可能性がある」ことを伝えてください。最後に、店舗への来店や宅配買取を促すようにしてください。'
};

const DEFAULT_SETTINGS: UserSettings = {
    user_id: '',
    voice_pitch: 1.65,
    voice_rate: 1.62,
    search_base_url: 'https://kinkaimasu.jp',
    character_image_url: 'https://rootomzbucovwdqsscqd.supabase.co/storage/v1/object/public/images/sugimaru400.png',
    background_image_url: 'https://rootomzbucovwdqsscqd.supabase.co/storage/v1/object/public/images/mypage_backgroud_resized.jpg',
    is_speech_enabled: true,
    is_vertex_ai_search_enabled: false,
    updated_at: new Date().toISOString(),
    is_zendesk_enabled: false,
    zendesk_subdomain: null,
    zendesk_user_email: null,
    zendesk_api_token: null,
    font_size: 14,
    telop_font_family: 'Inter, Roboto, sans-serif',
    telop_font_size: 14,
    voice_lang: 'ja-JP',
    voice_name: null,
};

const DEFAULT_DEMO_GENERATION_PROMPT = `あなたは、ウェブサイト「{BASE_URL}」のコンテンツを分析する専門家です。このサイトの訪問者がする可能性のある、よくある質問（FAQ）を100個、簡潔な日本語で生成してください。回答は、他の余計なテキストを含めず、質問の文字列の配列として、必ずJSON形式（例: ["質問1", "質問2", ...]）で返してください。`;


// WebRTC Configuration
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
  ],
};
const ROOM_ID = 'refasta-ai-call-room';

interface Message {
  role: 'user' | 'model' | 'viewer';
  text: string;
  image?: string;
  citations?: { uri: string; title: string }[];
}

type CharacterEmotion = 'neutral' | 'happy' | 'confused';
type AvatarMode = 'did' | 'chrome';

const EXAMPLE_PROMPTS = [
  "この時計はいくらくらいになりますか？",
  "査定に必要なものは何ですか？",
  "ダイヤモンドの指輪を売りたいです。",
];

const constructSearchUrl = (query: string, baseUrl: string): string => {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return baseUrl;
  }
  const encodedQuery = encodeURIComponent(trimmedQuery);
  // Assuming a search path like kinkaimasu.jp
  if (baseUrl.includes('kinkaimasu.jp')) {
    return `${baseUrl}/search_result/?q=${encodedQuery}#gsc.tab=0&gsc.q=${encodedQuery}&gsc.page=1`;
  }
  // Generic fallback
  return `${baseUrl}/search?q=${encodedQuery}`;
};

/** ▼▼▼ 追加：Markdown記号を読み上げ前に除去するユーティリティ ▼▼▼ */
function stripMarkdown(text: string): string {
  if (!text) return '';
  return text
    // 見出し (#)
    .replace(/^#{1,6}\s*/gm, '')
    // 強調 (*...* / **...** / _..._ / __...__)
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    // 取り消し ~~...~~
    .replace(/~~([^~]+)~~/g, '$1')
    // インラインコード `code`
    .replace(/`([^`]+)`/g, '$1')
    // コードブロック ```lang ... ```
    .replace(/```[\s\S]*?```/g, '')
    // リンク [text](url)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // 画像 ![alt](url)
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    // 箇条書き・番号付きリスト
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    // 引用 >
    .replace(/^\s*>+\s?/gm, '')
    // 表組みの罫線 | --- | 等は除去
    .replace(/^\s*\|.*\|\s*$/gm, '')
    .replace(/^\s*:-{3,}:?\s*\|.*$/gm, '')
    // 残った記号の掃除
    .replace(/[>*_`#]/g, '')
    // 余計な空白整形
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/金/g, 'きん')
    .trim();
}
/** ▲▲▲ 追加ここまで ▲▲▲ */

const getEmotionFromText = (text: string): CharacterEmotion => {
  const happyKeywords = ['ありがとう', '喜んで', '素晴らしい', 'もちろんです', '承知いたしました', 'お任seください'];
  const confusedKeywords = ['申し訳ありません', 'わかりません', '恐れります', 'できかねます', '難しいです'];

  // Japanese text does not have upper/lower case, so search directly.
  if (happyKeywords.some(keyword => text.includes(keyword))) {
    return 'happy';
  }
  if (confusedKeywords.some(keyword => text.includes(keyword))) {
    return 'confused';
  }
  return 'neutral';
};

const extractVideoID = (url: string): string | null => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    if (match && match[2].length === 11) {
        return match[2];
    }
    return null;
};


// Web Speech APIの型定義
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
    ImageCapture: any;
    aistudio: any;
  }
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [waitingCount, setWaitingCount] = useState(0);
  const [latestUserQuestion, setLatestUserQuestion] = useState<string | null>(null);
  const [supabaseTrigger, setSupabaseTrigger] = useState<string | null>(null);
  const [dbTestInput, setDbTestInput] = useState<string>('');
  const [shouldAutoSubmit, setShouldAutoSubmit] = useState(false);
  const [speakingTranscript, setSpeakingTranscript] = useState('');
  const [iframeUrl, setIframeUrl] = useState<string>('https://kinkaimasu.jp');
  const [isIframeModalOpen, setIsIframeModalOpen] = useState(false);
  const [searchStatus, setSearchStatus] = useState<'idle' | 'searching' | 'found' | 'fallback'>('idle');
  const [isImageGenerationMode, setIsImageGenerationMode] = useState(false);
  const [characterEmotion, setCharacterEmotion] = useState<CharacterEmotion>('neutral');
  const [isIframeVisible, setIsIframeVisible] = useState(true);
  const [isChatVisible, setIsChatVisible] = useState(true);
  
  // D-ID and Avatar Mode State
  const [avatarMode, setAvatarMode] = useState<AvatarMode>('chrome');
  const [isDidAgentConnected, setIsDidAgentConnected] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);


  // WebRTC State
  const [isCallActive, setIsCallActive] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);

  // Frame Capture State
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isCaptureModalOpen, setIsCaptureModalOpen] = useState(false);
  const [capturePrompt, setCapturePrompt] = useState('');
  
  // Voice Input State
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const voiceInputStartText = useRef('');

  // Login State
  const [session, setSession] = useState<any | null>(null);
  const [authView, setAuthView] = useState<'sign_in' | 'sign_up'>('sign_in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [showResend, setShowResend] = useState(false);

  // Management Modal State
  const [systemPrompt, setSystemPrompt] = useState<string>(DEFAULT_SYSTEM_PROMPT.content);
  const [isManagementModalOpen, setIsManagementModalOpen] = useState(false);
  const [managementTab, setManagementTab] = useState<'prompts' | 'settings' | 'demo' | 'knowledge' | 'advanced_search' | 'zendesk'>('prompts');
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [activePromptId, setActivePromptId] = useState<number | null>(null);
  const [selectedPrompt, setSelectedPrompt] = useState<Partial<Prompt> | null>(null);
  const [isPromptLoading, setIsPromptLoading] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean, message: string, severity: 'success' | 'error' | 'warning' | 'info' }>({ open: false, message: '', severity: 'success' });
  const [demoQuestions, setDemoQuestions] = useState<DemoQuestion[]>([]);
  const [newDemoQuestionText, setNewDemoQuestionText] = useState('');
  const [editingDemoQuestion, setEditingDemoQuestion] = useState<DemoQuestion | null>(null);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [generationPrompt, setGenerationPrompt] = useState(DEFAULT_DEMO_GENERATION_PROMPT);
  const [knowledgeBaseEntries, setKnowledgeBaseEntries] = useState<KnowledgeBaseEntry[]>([]);
  const [newKnowledgeEntry, setNewKnowledgeEntry] = useState<{question: string, source_url: string, content_type: string}>({ question: '', source_url: '', content_type: '' });
  const [editingKnowledgeEntry, setEditingKnowledgeEntry] = useState<KnowledgeBaseEntry | null>(null);

  // Video Generation State (Veo)
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [videoPrompt, setVideoPrompt] = useState('');
  const [videoAspectRatio, setVideoAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [isVideoGenerating, setIsVideoGenerating] = useState(false);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);


  // User Settings State
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [editableSettings, setEditableSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [isSpeechEnabled, setIsSpeechEnabled] = useState(true);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);


  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const mainVideoRef = useRef<HTMLVideoElement>(null);
  const pipVideoRef = useRef<HTMLVideoElement>(null);
  const webRtcChannelRef = useRef<any>(null);
  const isMicMutedRef = useRef(isMicMuted);
  const iceCandidateQueueRef = useRef<RTCIceCandidate[]>([]);
  const peerIdRef = useRef<string>(`peer_${Date.now()}_${Math.random().toString(36).substring(2)}`);
  const emotionTimeoutRef = useRef<number | null>(null);
  const agentManagerRef = useRef<any>(null);


  const theme = React.useMemo(() => createTheme({
    palette: {
      primary: {
        main: '#3b82f6', // blue-500
      },
      secondary: {
        main: '#c5a05b', // brand-gold
      },
      background: {
        default: '#f7f7f8',
        paper: '#ffffff',
      },
    },
    typography: {
      fontFamily: ['Inter', 'Roboto', 'sans-serif'].join(','),
      fontSize: settings.font_size || 14,
      h1: {
        fontFamily: ['Noto Serif JP', 'serif'].join(','),
      },
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            fontWeight: 500
          }
        }
      }
    },
  }), [settings.font_size]);

  useEffect(() => {
    isMicMutedRef.current = isMicMuted;
  }, [isMicMuted]);

  // Auth
  useEffect(() => {
    // Fix: Use Supabase v2 async method to get session. Cast to any to bypass environment-specific TS error.
    (supabase.auth as any).getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // Fix: Use v2 syntax for onAuthStateChange subscription. Cast to any to bypass environment-specific TS error.
    const { data: { subscription } } = (supabase.auth as any).onAuthStateChange((_event, session) => {
        setSession(session);
        if (_event === 'SIGNED_IN') {
          // Clear any previous chat history on new login
          const greetingText = 'はじめまして、わたくしリファスタの「AI査定員」です。\nご売却を検討されているお品物について、お気軽にご質問ください。\n画像を添付していただくと、より詳しいご案内が可能です。';
          setMessages([{ role: 'model', text: greetingText }]);
        }
    });

    return () => subscription?.unsubscribe();
  }, []);

  // Prompt & Settings Loading Effect
  useEffect(() => {
    if (session) {
      const initializeUserConfig = async () => {
        setIsPromptLoading(true);
        const userId = session.user.id;
        
        // --- Fetch User Settings ---
        const userSettings = await getUserSettings(userId);
        setSettings(userSettings);
        setEditableSettings(userSettings);
        setIsSpeechEnabled(userSettings.is_speech_enabled ?? true);
        setIframeUrl(userSettings.search_base_url || 'https://kinkaimasu.jp');

        // --- Fetch Demo Questions ---
        const userDemoQuestions = await getDemoQuestions(userId);
        setDemoQuestions(userDemoQuestions);

        // --- Fetch Prompts ---
        let currentActiveId = await getUserActivePromptId();
        let promptContent: string | null = null;
  
        if (currentActiveId) {
          promptContent = await getPromptContent(currentActiveId);
        }
  
        // If no active prompt is set or the content is missing, establish a default.
        if (!promptContent) {
          const userPrompts = await getPrompts(userId);
          if (userPrompts.length > 0) {
            // Use the most recent prompt as the default active one
            const firstPrompt = userPrompts[0];
            await updateUserActivePrompt(firstPrompt.id);
            currentActiveId = firstPrompt.id;
            promptContent = firstPrompt.content;
            setSnackbar({ open: true, message: '有効なプロンプトが設定されていなかったため、最新のものを適用しました。', severity: 'success' });
          } else {
            // Create the very first default prompt for the new user
            const newPrompt = await upsertPrompt({ ...DEFAULT_SYSTEM_PROMPT, user_id: userId });
            if (newPrompt) {
              await updateUserActivePrompt(newPrompt.id);
              currentActiveId = newPrompt.id;
              promptContent = newPrompt.content;
              console.log("✅ [Prompt] Created and set the first default prompt for the user.");
            }
          }
        }
        
        setSystemPrompt(promptContent || DEFAULT_SYSTEM_PROMPT.content);
        setActivePromptId(currentActiveId);
        console.log(`✅ [Config] Active prompt (ID: ${currentActiveId}), user settings, and demo questions loaded successfully.`);
        setIsPromptLoading(false);
      };
  
      initializeUserConfig().catch(error => {
        console.error("❌ [Config] Failed to initialize user config:", error);
        setSystemPrompt(DEFAULT_SYSTEM_PROMPT.content);
        setSettings(DEFAULT_SETTINGS);
        setSnackbar({ open: true, message: 'ユーザー設定の初期化に失敗しました。', severity: 'error' });
        setIsPromptLoading(false);
      });
    }
  }, [session]);


  // ログ出力用のiframeURL監視
  useEffect(() => {
    console.log('📺 [iframeUrl State] URL changed to:', iframeUrl);
  }, [iframeUrl]);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const demoTimeoutRef = useRef<number | null>(null);
  const demoQuestionIndexRef = useRef<number>(0);

  const hasUserSentMessage = messages.some(m => m.role === 'user');

  const handledIdsRef = useRef<Set<number>>(new Set());
  
  // Supabaseの購読エラーを処理するための共通ハンドラ
  const handleSubscriptionError = (err: any, tableName: string) => {
    const errorMessage = err?.message || 'Unknown subscription error';
    // デバッグ用に完全なエラーオブジェクトをログに出力
    console.error(`⛔ [Supabase] Channel subscription error on '${tableName}':`, errorMessage, err);

    // ユーザーに分かりやすい、実行可能なアドバイスを含むエラーメッセージを設定
    const detailedError = `リアルタイム接続に失敗しました (テーブル: ${tableName})。
これは通常、SupabaseのRow Level Security (RLS) ポリシーが原因です。
Supabaseダッシュボードで、'${tableName}' テーブルに対して 'anon' ロールがSELECT操作を許可するポリシーが有効になっていることを確認してください。`;

    setError(detailedError);
  };

  useEffect(() => {
    const greetingText = 'はじめまして、わたくしリファスタの「AI査定員」です。\nご売却を検討されているお品物について、お気軽にご質問ください。\n画像を添付していただくと、より詳しいご案内が可能です。';
    const greetingMessage: Message = { role: 'model', text: greetingText };
    setMessages([greetingMessage]);
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      window.speechSynthesis?.cancel();
      hangUp();
      disconnectDidAgent();
       if (emotionTimeoutRef.current) {
        clearTimeout(emotionTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if(!session) return;
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, session]);

  useEffect(() => {
    // --- Voice Input Setup ---
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'ja-JP';

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        // Iterate through all results. For final results, append them to our
        // base transcript. For interim results, concatenate them to display.
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            voiceInputStartText.current += transcript;
          } else {
            interimTranscript += transcript;
          }
        }
        setInput(voiceInputStartText.current + interimTranscript);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech Recognition Error:', event.error);
        if (event.error !== 'no-speech') {
          setError('音声認識エラーが発生しました。');
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } else {
      console.warn("Web Speech API is not supported in this browser.");
    }
    
    // --- Available Voices Loading ---
    const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
            setAvailableVoices(voices);
            console.log('🗣️ [Voices] Available voices loaded:', voices.length);
        }
    };
    loadVoices();
    // Voices may load asynchronously.
    window.speechSynthesis.onvoiceschanged = loadVoices;


    return () => {
      if (demoTimeoutRef.current) {
        clearTimeout(demoTimeoutRef.current);
      }
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []); 

  const fetchFirstSearchResult = async (query: string): Promise<string> => {
    setSearchStatus('searching');
    try {
      if (!query || typeof query !== 'string' || !query.trim()) {
        console.warn('⚠️ [Search] Invalid query provided:', query);
        setSearchStatus('fallback');
        return settings.search_base_url;
      }
      const searchUrl = constructSearchUrl(query, settings.search_base_url);
      console.log('🔍 [Search] Fetching search results from:', searchUrl);

      if (!searchUrl) {
        console.warn('⚠️ [Search] Invalid search URL generated');
        setSearchStatus('fallback');
        return settings.search_base_url;
      }
      setSearchStatus('found');
      return searchUrl;

    } catch (error) {
      console.error('❌ [Search] Error fetching search results:', error);
      setSearchStatus('fallback');
      return settings.search_base_url;
    }
  };

  useEffect(() => {
    if(!session) return;

    const testConnection = async () => {
      try {
        const { error } = await supabase.from('chat_history').select('id', { count: 'exact', head: true });
        if (error) {
          console.error('❌ [Supabase Debug] Connection test failed:', error.message, 'Details:', JSON.stringify(error, null, 2));
          const errorMessage = error.message || JSON.stringify(error);
          const detailedError = `Supabase接続テストエラー: ${errorMessage}。Row Level Security (RLS)が有効な場合、'chat_history'テーブルへのSELECT権限を確認してください。`;
          setError(detailedError);
        } else {
          console.log('✅ [Supabase Debug] Connection test successful.');
        }
      } catch (err) {
        console.error('❌ [Supabase Debug] Connection test exception:', err);
        setError(`Supabase接続例外: ${err instanceof Error ? err.message : '不明なエラー'}`);
      }
    };

    testConnection();

    const channel = supabase.channel('chat-history-inserts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_history' },
        (payload) => {
          console.log('📥 [Supabase] Change received:', payload);
          const row = payload.new as { id: number; content?: string };
          const newMessageText = row?.content;

          if (handledIdsRef.current.has(row.id)) {
            console.log('🔁 [Supabase] Already handled ID:', row.id);
            return;
          }
          handledIdsRef.current.add(row.id);

          if (newMessageText && typeof newMessageText === 'string' && newMessageText.trim() !== '') {
            console.log(`✅ [Supabase] Message received: "${newMessageText}".`);
            setSupabaseTrigger(newMessageText);
          } else {
            console.warn('⚠️ [Supabase] Message validation failed');
          }
        }
      )
      .subscribe((status, err) => {
        console.log(`🔄 [Supabase] Subscription status for 'chat_history': ${status}`);
        if (status === 'SUBSCRIBED') {
          console.log("✅ [Supabase] Successfully subscribed to 'chat_history' channel.");
          if (error?.includes('chat_history')) setError(null);
        } else if (status === 'CHANNEL_ERROR') {
          handleSubscriptionError(err, 'chat_history');
        } else if (status === 'TIMED_OUT') {
          console.warn("⌛ [Supabase] Subscription timed out for 'chat_history'.");
          setError("Supabase接続がタイムアウトしました (chat_history)。");
        } else if (status === 'CLOSED') {
          console.warn("🔒 [Supabase] Subscription closed for 'chat_history'.");
        }
      });

    return () => {
      console.log("🧹 [Supabase] Cleaning up 'chat_history' subscription...");
      supabase.removeChannel(channel);
    };
  }, [session, error]); 

  useEffect(() => {
    if (supabaseTrigger) {
      setInput(supabaseTrigger);
      setShouldAutoSubmit(true);
      setSupabaseTrigger(null);
    }
  }, [supabaseTrigger]);

  useEffect(() => {
    if (shouldAutoSubmit && input.trim() && !loading) {
      console.log('🚀 [Auto Submit] Automatically sending message:', input);
      setShouldAutoSubmit(false);
      handleStandardMessage(input, image, imageFile);
    }
  }, [shouldAutoSubmit, input, loading, image, imageFile]);

  useEffect(() => {
    if (loading || isDemoMode) return;

    const debounceTimer = setTimeout(async () => {
      const trimmedInput = input.trim();
      if (trimmedInput) {
        const searchUrl = constructSearchUrl(trimmedInput, settings.search_base_url);
        setIframeUrl(searchUrl);
        try {
          await fetchFirstSearchResult(trimmedInput);
          if (searchUrl) {
            setIframeUrl(searchUrl);
          }
        } catch (error) {
          console.warn('❌ [Search] Search processing error:', error);
          setSearchStatus('fallback');
        }
      } else {
        setSearchStatus('idle');
        if (!hasUserSentMessage) setIframeUrl(settings.search_base_url);
      }
    }, 750);

    return () => clearTimeout(debounceTimer);
  }, [input, loading, isDemoMode, hasUserSentMessage, settings.search_base_url]);

  const testSupabaseTable = async () => {
    if (!session) {
        setError("この機能を使用するにはログインが必要です。");
        return;
    }
    const messageToSend = dbTestInput.trim() || `テストメッセージ ${new Date().toISOString()}`;
    console.log(`🧪 [Supabase Test] Inserting: "${messageToSend}"`);
    try {
      const { data, error } = await insertChatMessage(messageToSend, session.user.id);

      if (error) {
        console.error('❌ [Supabase Test] Insert error:', error.message, 'Details:', JSON.stringify(error, null, 2));
        const errorMessage = error.message || JSON.stringify(error);
        setError(`テーブル挿入エラー: ${errorMessage}。RLSのINSERT権限を確認してください。`);
        return;
      }

      console.log('✅ [Supabase Test] Insert successful:', data);
      setDbTestInput('');
    } catch (err) {
      console.error('❌ [Supabase Test] Exception:', err);
      setError(`Supabaseテスト例外: ${err instanceof Error ? err.message : '不明なエラー'}`);
    }
  };

  useEffect(() => {
    const runDemoStep = () => {
      if (demoQuestionIndexRef.current >= demoQuestions.length) {
        setIsDemoMode(false);
        setMessages(prev => [...prev, { role: 'viewer', text: '自動デモが完了しました。手動でご質問ください。' }]);
        return;
      }

      const question = demoQuestions[demoQuestionIndexRef.current].question_text;
      handleStandardMessage(question, null, null, true);
      demoQuestionIndexRef.current += 1;
    };

    if (isDemoMode) {
      const remaining = demoQuestions.length - demoQuestionIndexRef.current;
      setWaitingCount(remaining > 0 ? remaining : 0);

      if (!loading) {
        if (demoQuestionIndexRef.current === 0) {
          runDemoStep();
        } else {
          demoTimeoutRef.current = window.setTimeout(runDemoStep, 45000);
        }
      }
    } else {
      if (demoTimeoutRef.current) clearTimeout(demoTimeoutRef.current);
      demoQuestionIndexRef.current = 0;
      setWaitingCount(0);
    }

    return () => {
      if (demoTimeoutRef.current) clearTimeout(demoTimeoutRef.current);
    };
  }, [isDemoMode, loading, demoQuestions]);

    const connectDidAgent = async () => {
        if (agentManagerRef.current || isDidAgentConnected) return;
        if ((D_ID_CLIENT_KEY as string) === 'YOUR_D-ID_API_KEY') {
            setError("D-ID APIキーが設定されていません。Home.tsxファイル内の`D_ID_CLIENT_KEY`を有効なキーに置き換えてください。");
            return;
        }

try {
    const agentManager = await DidSdk.createAgentManager(D_ID_AGENT_ID, {
        auth: { type: 'key', clientKey: D_ID_CLIENT_KEY },
        mode: 'talk' as any,

        // ← ★ これを追加して LLM の生成言語を日本語に固定
        language: 'ja',

        // 日本語音声を明示
        tts: {
            voice: "ja-JP-NanamiNeural",
            audio: { sampleRate: 44100 }
        },

        instructions: `
            あなたは日本語のみで回答するアシスタントです。
            中国語や英語など他の言語は使用しないでください。
            常に丁寧で自然な日本語で話してください。
        `,

        callbacks: {
            onConnectionStateChange: async (state) => {
                console.log('D-ID Connection State:', state);
                setIsDidAgentConnected(state === "connected");

                // 接続完了後に再度 system メッセージで上書き
                if (state === "connected") {
                    try {
                        const mgr = agentManagerRef.current;
                        if (mgr) {
                            await mgr.sendMessage({
                                role: "system",
                                content: "この会話では必ず日本語で話してください。"
                            });
                        }
                    } catch (e) {
                        console.error("❌ 初期 system メッセージ送信に失敗:", e);
                    }
                }
            },

            onSrcObjectReady: (obj) => {
                console.log('🎥 D-ID Stream Ready');
                setStream(obj);

                try {
                    const videoElement = document.getElementById("did-video") as HTMLVideoElement;
                    if (videoElement) {
                        // @ts-ignore
                        videoElement.srcObject = obj;
                        videoElement.play().catch(() => {
                            console.warn("Autoplay がブロックされました。");
                        });
                    }
                } catch (err) {
                    console.error("ストリーム接続エラー:", err);
                }
            },

            onNewMessage: (messages) => {
                const lastMessage = messages[messages.length - 1];
                if (lastMessage?.role === 'assistant') {
                    setSpeakingTranscript(lastMessage.content);
                }
            },

            onError: (error, data) => {
                console.error("❌ D-ID Error:", error, data);
                setError("D-IDアバターの接続に失敗しました。");
                setIsDidAgentConnected(false);
                agentManagerRef.current = null;
            }
        }
    });

    agentManagerRef.current = agentManager;
    await agentManager.connect();

} catch (error) {
    console.error("❌ Agent init failed:", error);
    setError("初期化に失敗しました。APIキーまたはAgent IDを確認してください。");
    setIsDidAgentConnected(false);
    agentManagerRef.current = null;
}


    };

    const disconnectDidAgent = () => {
        if (agentManagerRef.current && isDidAgentConnected) {
            agentManagerRef.current.disconnect();
            agentManagerRef.current = null;
            setIsDidAgentConnected(false);
            setStream(null);
        }
    };
    
    // Auto-connect/disconnect D-ID agent based on mode
    useEffect(() => {
        if (avatarMode === 'did') {
            connectDidAgent();
        } else {
            disconnectDidAgent();
        }
        return () => {
            disconnectDidAgent();
        };
    }, [avatarMode]);

    const speakWithDid = async (text: string) => {
        if (!isDidAgentConnected || !agentManagerRef.current) {
            console.warn('D-ID agent not connected. Cannot speak.');
            setError('D-IDアバターが接続されていません。');
            return;
        }
        try {
            const plainText = stripMarkdown(text);
            await agentManagerRef.current.speak({ type: 'text', input: plainText });
        } catch (error) {
            console.error('D-ID speak error:', error);
            setError('D-IDアバターの音声再生に失敗しました。');
        }
    };


  const speakWithChromeVoice = (text: string) => {
    if (!window.speechSynthesis || !isSpeechEnabled || availableVoices.length === 0) return;
    window.speechSynthesis.cancel(); // Cancel any previous speech
    
    const fullText = stripMarkdown(text);
    if (!fullText) return;

    const utterance = new SpeechSynthesisUtterance(fullText);
    utterance.lang = settings.voice_lang || 'ja-JP';
    utterance.pitch = settings.voice_pitch;
    utterance.rate = settings.voice_rate;
    
    if (settings.voice_name) {
        const selectedVoice = availableVoices.find(v => v.name === settings.voice_name);
        if (selectedVoice) {
            utterance.voice = selectedVoice;
        } else {
            console.warn(`[Speech] Voice "${settings.voice_name}" not found. Using default for lang "${utterance.lang}".`);
        }
    }


    // Split text into sentences to display them one by one.
    const sentences = fullText.match(/[^。！？\n]+[。！？\n]?/g) || [fullText];
    let currentSentenceIndex = -1;

    // Use onstart to display the first sentence immediately.
    utterance.onstart = () => {
      setSpeakingTranscript(sentences[0]?.trim() ?? '');
      currentSentenceIndex = 0;
    };

    utterance.onboundary = (event: SpeechSynthesisEvent) => {
      const charIndex = event.charIndex;
      let cumulativeLength = 0;

      for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i];
        if (charIndex < cumulativeLength + sentence.length) {
          if (currentSentenceIndex !== i) {
            setSpeakingTranscript(sentence.trim());
            currentSentenceIndex = i;
          }
          break; 
        }
        cumulativeLength += sentence.length;
      }
    };
    
    utterance.onend = () => {
      // Keep the last sentence for a moment, then clear it.
      setTimeout(() => setSpeakingTranscript(''), 2500);
    };

    utterance.onerror = (event: any) => {
      console.error('SpeechSynthesis Error:', event.error);
      setError(`音声の再生に失敗しました: ${event.error}`);
      setSpeakingTranscript(''); // Clear on error
    };
    
    window.speechSynthesis.speak(utterance);
  };
  
    const speak = (text: string) => {
        if (!isSpeechEnabled) return;

        if (avatarMode === 'did') {
            speakWithDid(text);
        } else {
            speakWithChromeVoice(text);
        }
    };

  /**
   * Calls the AppSheet API to log an event with OCR data.
   * This is triggered when an image containing personal information is detected.
   */
  const insertEoc = async (ocrData: { name?: string; address?: string; date_of_birth?: string; document_type?: string; document_number?: string }) => {
    // === 固定設定 ===
    const APP_ID = '2969673b-d166-4393-93c0-b75cde859e9a';
    const ACCESS_KEY = 'V2-PHlzq-uXP52-YCath-FYOEK-YypGT-CvzWy-CyNeu-QT24D';
    const TABLE_NAME = 'Eoc';
    const url = `https://api.appsheet.com/api/v2/apps/${APP_ID}/tables/${TABLE_NAME}/Action`;

    // === 挿入データ (OCRデータで動的に生成) ===
    const description = `種別: ${ocrData.document_type || 'N/A'}, 住所: ${ocrData.address || 'N/A'}, 番号: ${ocrData.document_number || 'N/A'}`;

    const record = {
      "Action": "Add",
      "Properties": {
        "Locale": "ja-JP",
        "Timezone": "Asia/Tokyo"
      },
      "Rows": [
        {
          "ecc_seq": "TEST-001",
          "name1": ocrData.name || "名前不明", // OCRから取得した名前に変更
          "created_t": new Date().toISOString(),
          "registerd_id": 999999, // 固定値のまま
          "kaitori_staff_id": "staff_demo", // 固定値のまま
          "name2": description, // 住所などの詳細情報をここに格納
          "wareki": ocrData.date_of_birth || "生年月日不明", // OCRから取得した生年月日に変更
          "b1": 100 // 固定値のまま
        }
      ]
    };

    // === API呼び出し (クライアントサイド) ===
    const options = {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'ApplicationAccessKey': ACCESS_KEY 
      },
      body: JSON.stringify(record),
    };

    try {
      console.log('🚀 [AppSheet] Calling EOC insert API with OCR data...', record.Rows[0]);
      const response = await fetch(url, options);
      const responseText = await response.text();
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}, body: ${responseText}`);
      }
      console.log('✅ [AppSheet] EOC Insert Response:', responseText);
      setSnackbar({ open: true, message: '個人情報を検出し、記録APIを呼び出しました。', severity: 'success' });
    } catch (error) {
      console.error('❌ [AppSheet] EOC Insert Failed:', error);
      setError('個人情報記録APIの呼び出しに失敗しました。');
    }
  };

  /**
   * Analyzes an image for personal information and triggers the EOC log if detected.
   * @param imageFile The image file to analyze.
   */
  const checkForPersonalInfoAndLog = async (imageFile: File) => {
    console.log('🕵️ [PII Check] Analyzing image for personal information and performing OCR...');
    try {
      const reader = new FileReader();
      reader.readAsDataURL(imageFile);
      reader.onloadend = async () => {
        const base64Image = (reader.result as string)?.split(',')[1];
        if (!base64Image) {
          console.warn('⚠️ [PII Check] Could not read image data.');
          return;
        }

        const imagePart = {
          inlineData: {
            mimeType: imageFile.type,
            data: base64Image,
          },
        };

        const textPart = {
          text: `この画像は日本の公的な身分証明書（運転免許証、健康保険証、マイナンバーカードなど）ですか？
もしそうであれば、以下の情報をJSON形式で抽出してください。該当する情報がない項目は "null" としてください。
- 氏名 (name)
- 住所 (address)
- 生年月日 (date_of_birth)
- 番号 (document_number)
- 種類 (document_type) -> "運転免許証", "健康保険証", "マイナンバーカード"など

もし身分証明書でない場合は、 "null" とだけ返答してください。

例:
{
  "document_type": "運転免許証",
  "name": "公安 太郎",
  "address": "東京都千代田区霞が関2-1-2",
  "date_of_birth": "昭和60年4月1日",
  "document_number": "第123456789012号"
}`,
        };

        const response = await ai.models.generateContent({
          model: MODEL_NAME,
          contents: { parts: [imagePart, textPart] },
        });
        
        let resultText = response.text.trim();
        console.log(`[PII Check] Model OCR/analysis response: "${resultText}"`);

        // Clean up potential markdown code block formatting
        if (resultText.startsWith('```json')) {
            resultText = resultText.substring(7, resultText.length - 3).trim();
        } else if (resultText.startsWith('```')) {
            resultText = resultText.substring(3, resultText.length - 3).trim();
        }

        if (resultText && resultText.toLowerCase() !== 'null' && resultText.startsWith('{')) {
          try {
            const ocrData = JSON.parse(resultText);
            if (typeof ocrData === 'object' && ocrData !== null && Object.keys(ocrData).length > 0) {
              console.log('✅ [PII Check] Personal information detected. Triggering EOC log with OCR data.');
              await insertEoc(ocrData);
            } else {
              console.log('ℹ️ [PII Check] Model returned parsable but empty/invalid JSON. Assuming no PII.');
            }
          } catch (jsonError) {
            console.error('❌ [PII Check] Failed to parse JSON from model response:', jsonError, `Response was: "${resultText}"`);
          }
        } else {
          console.log('ℹ️ [PII Check] No personal information document detected.');
        }
      };
    } catch (err) {
      console.error('❌ [PII Check] Error during personal information check:', err);
    }
  };


  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImage(null);
    setImageFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleToggleListening = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      voiceInputStartText.current = input;
      recognitionRef.current.start();
    }
    setIsListening(!isListening);
  };

  // Fix: The event handler for onPaste on a form component should use React.ClipboardEvent<HTMLFormElement>
  // to avoid type mismatches when passing it to the Box component.
  const handlePaste = (e: React.ClipboardEvent<HTMLFormElement>) => {
    if (loading || isDemoMode || image || isImageGenerationMode) return;

    // Check if pasted content is a YouTube URL
    const pastedText = e.clipboardData.getData('text');
    if (extractVideoID(pastedText)) {
      setYoutubeUrl(pastedText);
      // Prevent the text from being pasted into the main input
      e.preventDefault();
      return;
    }
    
    // Original image paste logic
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file' && item.type.startsWith('image/')) {
            e.preventDefault(); 
            const file = item.getAsFile();
            if (file) {
                setImageFile(file);
                const reader = new FileReader();
                reader.onloadend = () => setImage(reader.result as string);
                reader.readAsDataURL(file);
                break;
            }
        }
    }
  };

  async function generateImageFromPrompt(prompt: string) {
    const userMessage: Message = { role: 'user', text: prompt };
    setMessages((prev) => [...prev, userMessage]);

    setLoading(true);
    setError(null);
    setInput('');
    setCharacterEmotion('neutral');

    try {
      setMessages((prev) => [...prev, { role: 'model', text: '画像を生成中です… しばらくお待ちください。' }]);
      
      const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: prompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/jpeg',
          aspectRatio: '1:1',
        },
      });

      const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
      const imageUrl = `data:image/jpeg;base64,${base64ImageBytes}`;
      
      const imageMessage: Message = {
        role: 'model',
        text: `「${prompt}」の画像を生成しました。`,
        image: imageUrl,
      };

      setMessages((prev) => {
        const newMessages = [...prev];
        if (newMessages[newMessages.length - 1].text.includes('画像を生成中です')) {
          newMessages[newMessages.length - 1] = imageMessage;
        } else {
          newMessages.push(imageMessage);
        }
        return newMessages;
      });
      

      if(isSpeechEnabled) {
        speak(imageMessage.text);
      }

    } catch (err) {
      console.error("Image generation error:", err);
      const errorMessage = '画像の生成中にエラーが発生しました。プロンプトがポリシーに違反している可能性があります。';
      setError(errorMessage);
      setMessages(prev => {
        const newMessages = [...prev];
        if (newMessages[newMessages.length - 1].text.includes('画像を生成中です')) {
            newMessages[newMessages.length - 1].text = errorMessage;
        } else {
            newMessages.push({ role: 'model', text: errorMessage });
        }
        return newMessages;
      });
    } finally {
      setLoading(false);
    }
  }

  // --- Veo Video Generation Function ---
  const handleGenerateVideo = async () => {
    if (!videoPrompt.trim()) return;

    setIsVideoGenerating(true);
    setVideoError(null);
    setGeneratedVideoUrl(null);

    try {
      // API Key Check (Paid tier check)
      const hasKey = await window.aistudio.hasSelectedApiKey();
      if (!hasKey) {
          try {
            const success = await window.aistudio.openSelectKey();
            if (!success) {
                // User cancelled or failed
                setIsVideoGenerating(false);
                return;
            }
          } catch (keyError: any) {
              if (keyError.message?.includes("Requested entity was not found")) {
                   setVideoError("APIキーの選択に失敗しました。もう一度お試しください。");
                   // Reset prompt if needed or just let them try again
                   await window.aistudio.openSelectKey();
              } else {
                  throw keyError;
              }
          }
      }

      // Re-initialize AI client with potentially new key from selection (implicitly handled by process.env.API_KEY if environment updates, but specific instruction says create new instance)
      const videoAi = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      console.log(`🎥 [Veo] Starting generation: "${videoPrompt}" (${videoAspectRatio})`);
      
      let operation = await videoAi.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: videoPrompt,
        config: {
            numberOfVideos: 1,
            aspectRatio: videoAspectRatio
        }
      });

      // Polling loop
      while (!operation.done) {
          console.log('⏳ [Veo] Generating... waiting 10s');
          await new Promise(resolve => setTimeout(resolve, 10000));
          operation = await videoAi.operations.getVideosOperation({ operation: operation });
      }

      if (operation.error) {
          throw new Error(String(operation.error.message) || "Unknown generation error");
      }

      const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (!videoUri) {
          throw new Error("No video URI returned");
      }

      console.log('✅ [Veo] Generation complete. Fetching video content...');
      // Fetch the actual video blob
      const videoRes = await fetch(`${videoUri}&key=${process.env.API_KEY}`);
      if (!videoRes.ok) {
          throw new Error(`Failed to download video: ${videoRes.statusText}`);
      }
      
      const videoBlob = await videoRes.blob();
      const videoUrl = URL.createObjectURL(videoBlob);
      setGeneratedVideoUrl(videoUrl);
      setSnackbar({ open: true, message: '動画の生成が完了しました！', severity: 'success' });

    } catch (err: any) {
        console.error("❌ [Veo] Generation failed:", err);
        setVideoError(err.message || '動画の生成中にエラーが発生しました。');
    } finally {
        setIsVideoGenerating(false);
    }
  };


  const processApiResponseStream = async (stream: ReadableStream, isDemo: boolean = false) => {
    try {
        const reader = stream.getReader();
        const decoder = new TextDecoder();

        setMessages((prev) => [...prev, { role: 'model', text: '' }]);

        let fullResponse = '';
        let citations: { uri: string; title: string }[] = [];
        let unprocessedText = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            unprocessedText += decoder.decode(value, { stream: true });
            const lines = unprocessedText.split('\n\n');
            unprocessedText = lines.pop() || '';

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const jsonString = line.substring(6);
                    if (jsonString) {
                        try {
                            const parsedData = JSON.parse(jsonString);
                            if (parsedData.text) {
                                fullResponse += parsedData.text;
                                setMessages((prev) => {
                                    const newMessages = [...prev];
                                    newMessages[newMessages.length - 1].text = fullResponse;
                                    return newMessages;
                                });
                            }
                            if (parsedData.groundingMetadata?.groundingChunks) {
                                const webChunks = parsedData.groundingMetadata.groundingChunks
                                    .map((c: any) => c.web)
                                    .filter((c: any): c is { uri: string, title: string } => !!(c && c.uri && c.title));
                                citations.push(...webChunks);
                            }
                        } catch (e) {
                            console.error('Failed to parse SSE data chunk:', jsonString);
                        }
                    }
                }
            }
        }
        
        if (fullResponse.trim() && isSpeechEnabled) {
            speak(fullResponse.trim());
        }

        const uniqueCitations = Array.from(new Map(citations.map(c => [c.uri, c])).values());
        setMessages(prev => {
            const newMessages = [...prev];
            const lastMessage = newMessages[newMessages.length - 1];
            if (lastMessage.role === 'model') {
                lastMessage.citations = uniqueCitations.length > 0 ? uniqueCitations : undefined;
            }
            return newMessages;
        });

        const finalEmotion = getEmotionFromText(fullResponse);
        setCharacterEmotion(finalEmotion);
        emotionTimeoutRef.current = window.setTimeout(() => setCharacterEmotion('neutral'), 5000);

        if (fullResponse && fullResponse.trim() && session) {
            await saveAnswerToSupabase(fullResponse.trim(), session.user.id);
        }
    } catch (apiError) {
        console.error("API Stream processing error:", apiError);
        const errorMessage = 'AIからの応答ストリームの処理中にエラーが発生しました。';
        setError(errorMessage);
        setMessages(prev => [...prev, { role: 'model', text: errorMessage }]);
        setCharacterEmotion('confused');
    }
  };

  async function streamResponseFromEdgeFunction(contentsPayload: any[], isDemo: boolean = false) {
    try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !sessionData.session) {
            throw new Error("認証セッションが見つかりません。");
        }
        
        const { access_token } = sessionData.session;
        
        // Fix: Hardcode the Supabase URL to resolve the "Property 'env' does not exist on type 'ImportMeta'"
        // error, following the pattern established in supabaseClient.tsx.
        const response = await fetch(`https://rootomzbucovwdqsscqd.supabase.co/functions/v1/vertex-ai-search`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${access_token}`
            },
            body: JSON.stringify({
                contents: contentsPayload,
                systemInstruction: systemPrompt
            })
        });

        if (!response.ok) {
            const errorBody = await response.json();
            throw new Error(errorBody.error || `Edge Function request failed with status ${response.status}`);
        }

        if (!response.body) {
            throw new Error("Edge Function did not return a readable stream.");
        }

        await processApiResponseStream(response.body, isDemo);

    } catch (apiError) {
        console.error("Edge Function error:", apiError);
        const errorMessage = `高度な検索機能でエラーが発生しました: ${(apiError as Error).message}`;
        setError(errorMessage);
        setMessages(prev => [...prev, { role: 'model', text: errorMessage }]);
        setCharacterEmotion('confused');
    }
  }


  async function streamGeminiResponse(prompt: string | any[], isDemo: boolean = false) {
    try {
        const contentsPayload = Array.isArray(prompt) ? prompt : [...messages.filter(m => m.role !== 'viewer' && m.text).map(msg => ({
            role: msg.role,
            parts: [{ text: msg.text || '' }]
        })), { role: 'user', parts: [{ text: prompt }] }];
        
        setMessages((prev) => [...prev, { role: 'model', text: '' }]);

        const stream = await ai.models.generateContentStream({
            model: MODEL_NAME,
            contents: contentsPayload,
            config: {
                systemInstruction: systemPrompt,
                tools: [{ googleSearch: {} }],
            },
        });

        let fullResponse = '';
        let citations: { uri: string; title: string }[] = [];

        for await (const chunk of stream) {
            const text = chunk.text;
            if (text) {
                fullResponse += text;
                setMessages((prev) => {
                    const newMessages = [...prev];
                    if (newMessages.length > 0 && newMessages[newMessages.length - 1].role === 'model') {
                        newMessages[newMessages.length - 1].text = fullResponse;
                    }
                    return newMessages;
                });
            }
            if (chunk.candidates?.[0]?.groundingMetadata?.groundingChunks) {
                const webChunks = chunk.candidates[0].groundingMetadata.groundingChunks
                    .map((c: any) => c.web)
                    .filter((c: any): c is { uri: string, title: string } => !!(c && c.uri && c.title));
                citations.push(...webChunks);
            }
        }
        
        if (fullResponse.trim() && isSpeechEnabled) {
            speak(fullResponse.trim());
        }

        const uniqueCitations = Array.from(new Map(citations.map(c => [c.uri, c])).values());
        setMessages(prev => {
            const newMessages = [...prev];
            const lastMessage = newMessages[newMessages.length - 1];
            if (lastMessage.role === 'model') {
                lastMessage.citations = uniqueCitations.length > 0 ? uniqueCitations : undefined;
            }
            return newMessages;
        });

        const finalEmotion = getEmotionFromText(fullResponse);
        setCharacterEmotion(finalEmotion);
        emotionTimeoutRef.current = window.setTimeout(() => setCharacterEmotion('neutral'), 5000);

        if (fullResponse && fullResponse.trim() && session) {
            await saveAnswerToSupabase(fullResponse.trim(), session.user.id);
        }

    } catch (apiError) {
        console.error("Gemini API error:", apiError);
        const errorMessage = 'AIからの応答の取得中にエラーが発生しました。しばらくしてからもう一度お試しください。';
        setError(errorMessage);
        setMessages(prev => {
            const newMessages = [...prev];
             if (newMessages.length > 0 && newMessages[newMessages.length - 1].role === 'model') {
                 newMessages[newMessages.length - 1].text = errorMessage;
            } else {
                 newMessages.push({ role: 'model', text: errorMessage });
            }
            return newMessages;
        });
        setCharacterEmotion('confused');
    }
  }

  async function handleYoutubeUrl(url: string) {
    const videoId = extractVideoID(url);
    if (!videoId) {
        setError('無効なYouTube URLです。');
        return;
    }

    setLoading(true);
    setError(null);
    setInput('');
    setYoutubeUrl('');
    removeImage();

    setMessages(prev => [...prev, { role: 'user', text: `この動画を処理してください: ${url}` }]);
    setMessages(prev => [...prev, { role: 'model', text: 'YouTubeの動画から文字起こしを取得しています...' }]);

    try {
        const { transcript, error: transcriptError } = await invokeYoutubeTranscript(videoId);
        if (transcriptError || !transcript) {
            throw new Error(transcriptError || '文字起こしが見つかりませんでした。');
        }

        setMessages(prev => {
            const newMessages = [...prev];
            newMessages[newMessages.length - 1].text = '文字起こしを要約し、内容について回答します...';
            return newMessages;
        });

        const fullPrompt = `あなたはプロのアナリストです。以下のYouTube動画の文字起こしを分析してください。
まず、動画全体の要点を3〜5個の箇条書きでまとめてください。
次に、動画の内容について詳しく解説してください。
最後に、ユーザーが次に行うべきアクションや、関連する質問を提案してください。
ユーザーからの追加の質問があれば、この文字起こしの内容を元に回答してください。
ユーザーからの質問: "${input || 'この動画について教えて'}"
--- 文字起こし開始 ---
${transcript}
--- 文字起こし終了 ---`;
        
        const history = messages.filter(m => m.role !== 'viewer').map(msg => ({
            role: msg.role,
            parts: [{ text: msg.text || '' }]
        }));

        const contentsPayload = [...history, { role: 'user', parts: [{text: fullPrompt}] }];

        if (settings.is_vertex_ai_search_enabled) {
          await streamResponseFromEdgeFunction(contentsPayload);
        } else {
          await streamGeminiResponse(contentsPayload);
        }

    } catch (err) {
        console.error("YouTube processing error:", err);
        const errorMessage = `動画の処理中にエラーが発生しました。URLが正しいか、動画に字幕が有効になっているか確認してください。(${(err as Error).message})`;
        setError(errorMessage);
        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[newMessages.length-1].text = errorMessage;
          return newMessages;
        });
        setCharacterEmotion('confused');
    } finally {
        setLoading(false);
    }
  }


  async function handleStandardMessage(messageText: string, attachedImage: string | null, attachedImageFile: File | null, isDemo: boolean = false) {
    if (emotionTimeoutRef.current) {
        clearTimeout(emotionTimeoutRef.current);
    }
    window.speechSynthesis.cancel();
    setSpeakingTranscript('');
    setLatestUserQuestion(messageText);

    const trimmedMessage = messageText.trim();
    if (trimmedMessage) {
        const searchUrl = constructSearchUrl(trimmedMessage, settings.search_base_url);
        setIframeUrl(searchUrl);
        try {
            await fetchFirstSearchResult(trimmedMessage);
        } catch (error) {
            console.warn('❌ [Message] Search processing error:', error);
        }
    }
    
    // Add user message to the chat log for both manual and demo questions.
    const userMessage: Message = { role: 'user', text: messageText };
    if (attachedImage) userMessage.image = attachedImage;
    setMessages((prev) => [...prev, userMessage]);
    
    setLoading(true);
    setError(null);
    if (!isDemo) {
        setInput('');
        removeImage();
    }
    
    // Fire-and-forget the PII check so it doesn't block the UI
    if (attachedImageFile) {
        checkForPersonalInfoAndLog(attachedImageFile);
    }

    let uploadedImageUrl: string | null = null;
    if (attachedImageFile && session) {
        try {
            uploadedImageUrl = await uploadFileAndGetUrl(attachedImageFile, session.user.id);
            setMessages(prev => {
                const newMessages = [...prev];
                const lastMessage = newMessages[newMessages.length - 1];
                if (lastMessage && lastMessage.role === 'user' && lastMessage.image) {
                    lastMessage.image = uploadedImageUrl;
                }
                return newMessages;
            });
        } catch (uploadError: any) {
            console.error("File upload failed:", uploadError);
            let userFriendlyError = '画像のアップロードに失敗しました。';
            if (uploadError.message && uploadError.message.includes('Bucket not found')) {
                userFriendlyError += ' Supabaseのストレージ設定で `chat_uploads` という名前の公開バケットが作成されているか、またアクセスポリシーが正しく設定されているか確認してください。';
            } else {
                userFriendlyError += ' ストレージ設定またはネットワーク接続を確認してください。';
            }
            setError(userFriendlyError);
            
            setMessages(prev => {
                const newMessages = [...prev];
                const lastMessage = newMessages[newMessages.length - 1];
                if (lastMessage && lastMessage.role === 'user' && lastMessage.image) {
                    delete lastMessage.image;
                }
                return newMessages;
            });

            setLoading(false);
            return;
        }
    }

    try {
        const currentUserParts: any[] = [];
        if (attachedImage && attachedImageFile) {
            const imagePart = {
                inlineData: {
                    mimeType: attachedImageFile.type,
                    data: attachedImage.split(',')[1],
                },
            };
            currentUserParts.push(imagePart);
        }
        currentUserParts.push({ text: messageText });

        const history = messages.filter(m => m.role !== 'viewer').map(msg => ({
            role: msg.role,
            parts: [{ text: msg.text || '' }]
        }));

        const contentsPayload = [...history, { role: 'user', parts: currentUserParts }];
        
        if (settings.is_vertex_ai_search_enabled) {
            await streamResponseFromEdgeFunction(contentsPayload, isDemo);
        } else {
            await streamGeminiResponse(contentsPayload, isDemo);
        }

    } catch (apiError) {
        console.error("API call error:", apiError);
        const errorMessage = 'AIからの応答の取得中にエラーが発生しました。しばらくしてからもう一度お試しください。';
        setError(errorMessage);
        setMessages(prev => [...prev, { role: 'model', text: errorMessage }]);
        setCharacterEmotion('confused');
    } finally {
        setLoading(false);
    }
}

  const submitMessage = () => {
    if ((!input.trim() && !image && !youtubeUrl.trim()) || loading) return;
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }

    if(youtubeUrl.trim()){
      handleYoutubeUrl(youtubeUrl);
    } else if (isImageGenerationMode) {
      generateImageFromPrompt(input);
    } else {
      handleStandardMessage(input, image, imageFile);
    }
  };

  // Fix: Specify the event type as React.FormEvent<HTMLFormElement> for type safety with the Box component.
  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    submitMessage();
  };

  const handleExamplePromptClick = (prompt: string) => {
    if (loading) return;
    setInput(prompt);
  };

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setShowResend(false);
    setIsAuthLoading(true);
    // Fix: Use `signInWithPassword` (v2) instead of `signIn` (v1). Cast to any to bypass environment-specific TS error.
    const { error } = await (supabase.auth as any).signInWithPassword({ email, password });
    if (error) {
      if (error.message === 'Email not confirmed') {
        setAuthError('メールアドレスの確認が完了していません。受信トレイ（または迷惑メールフォルダ）をご確認の上、確認リンクをクリックしてください。');
        setShowResend(true);
      } else {
        setAuthError(error.message);
      }
    }
    setIsAuthLoading(false);
  };

  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setShowResend(false);
    setIsAuthLoading(true);
    // Fix: Cast to any to bypass environment-specific TS error.
    const { error } = await (supabase.auth as any).signUp({ email, password });
    if (error) {
        setAuthError(error.message);
    } else {
        alert('確認メールを送信しました。メール内のリンクをクリックして登録を完了してください。');
        setAuthView('sign_in');
    }
    setIsAuthLoading(false);
  };

  const handleResendConfirmation = async () => {
    setAuthError(null);
    setIsAuthLoading(true);
    // Fix: Use `resend` for resending confirmation email in v2. Cast to any to bypass environment-specific TS error.
    const { error } = await (supabase.auth as any).resend({ type: 'signup', email });
    if (error) {
      setAuthError(`再送信に失敗しました: ${error.message}`);
    } else {
      alert('確認メールを再送信しました。メールをご確認ください。');
      setShowResend(false);
    }
    setIsAuthLoading(false);
  };

  
  // ---------------- WebRTC Functions ----------------

  const setupPeerConnection = (stream: MediaStream) => {
    // 新しい接続のためにICE候補キューをリセット
    iceCandidateQueueRef.current = [];
    const pc = new RTCPeerConnection(ICE_SERVERS);

    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    pc.onicecandidate = event => {
      if (event.candidate) {
        sendSignal({ ice: event.candidate });
      }
    };

    pc.ontrack = event => {
      setRemoteStream(event.streams[0]);
    };

    peerConnectionRef.current = pc;
    return pc;
  };

  const sendSignal = async (signal: any) => {
    await sendWebRTCSignal(ROOM_ID, { ...signal, sender: peerIdRef.current });
  };
  
  const startCall = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      setIsCallActive(true);
      
      const pc = setupPeerConnection(stream);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      sendSignal({ sdp: offer });
    } catch (err) {
      console.error("Error starting call:", err);
      setError("カメラまたはマイクへのアクセスに失敗しました。");
    }
  };

  const handleInitiateCall = () => {
    setIsContactModalOpen(true);
  };
  
  const hangUp = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    iceCandidateQueueRef.current = []; // ICE候補キューもクリア
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    setLocalStream(null);
    setRemoteStream(null);
    setIsCallActive(false);
    setIsSharingScreen(false);
    setIsMicMuted(false);
  };
  
  const toggleMic = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMicMuted(prev => !prev);
    }
  };
  
  const shareScreen = async () => {
    if (!peerConnectionRef.current) return;

    if (isSharingScreen) {
      // 画面共有を停止し、カメラに戻す
      try {
        const cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        // マイクの状態を維持
        cameraStream.getAudioTracks().forEach(track => track.enabled = !isMicMuted);
        
        const videoTrack = cameraStream.getVideoTracks()[0];
        const sender = peerConnectionRef.current.getSenders().find(s => s.track?.kind === 'video');
        
        if (sender) {
          await sender.replaceTrack(videoTrack);
        }
        
        localStream?.getTracks().forEach(track => track.stop()); // 古い画面共有ストリームを停止
        setLocalStream(cameraStream);
        setIsSharingScreen(false);
      } catch (err) {
        console.error("Failed to switch back to camera:", err);
        setError("カメラへの切り替えに失敗しました。");
      }
    } else {
      // 画面共有を開始する
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        
        // マイクの状態を維持
        if(isMicMuted){
            screenStream.getAudioTracks().forEach(track => track.enabled = false);
        }

        const screenTrack = screenStream.getVideoTracks()[0];
        const sender = peerConnectionRef.current.getSenders().find(s => s.track?.kind === 'video');

        if (sender) {
          await sender.replaceTrack(screenTrack);
        }

        // ユーザーがブラウザのUIで共有を停止した際のイベントハンドラ
        screenTrack.onended = () => {
          (async () => {
            try {
              const cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
              // stale state問題を回避するため、refから最新のマイク状態を取得
              cameraStream.getAudioTracks().forEach(track => track.enabled = !isMicMutedRef.current);
              const videoTrack = cameraStream.getVideoTracks()[0];
              const currentSender = peerConnectionRef.current?.getSenders().find(s => s.track?.kind === 'video');
              if (currentSender) {
                await currentSender.replaceTrack(videoTrack);
              }
              // ブラウザがトラックを停止させるため、ここでの停止処理は不要
              setLocalStream(cameraStream);
              setIsSharingScreen(false);
            } catch (err) {
              console.error("Failed to switch back to camera automatically:", err);
            }
          })();
        };

        localStream?.getTracks().forEach(track => track.stop()); // 古いカメラストリームを停止
        setLocalStream(screenStream);
        setIsSharingScreen(true);
      } catch (err) {
        console.error("Failed to start screen sharing:", err);
        // ユーザーが共有をキャンセルした場合のエラーは無視
        if ((err as DOMException).name !== 'NotAllowedError') {
          setError("画面共有の開始に失敗しました。");
        }
      }
    }
  };

  const handleSignal = async (payload: any) => {
    const signal = payload.new.signal as { sdp?: RTCSessionDescriptionInit; ice?: RTCIceCandidateInit; sender?: string };

    // 自分自身が送信したシグナルは無視する
    if (signal.sender === peerIdRef.current) {
      return;
    }

    const pc = peerConnectionRef.current;

    try {
        if (signal.ice) {
            const candidate = new RTCIceCandidate(signal.ice);
            // リモートデスクリプションが設定される前に到着した候補はキューに入れる
            if (pc && pc.remoteDescription) {
                await pc.addIceCandidate(candidate);
                // キューに溜まっている他の候補も処理する
                while(iceCandidateQueueRef.current.length > 0) {
                    const queuedCandidate = iceCandidateQueueRef.current.shift();
                    if (queuedCandidate) {
                       await pc.addIceCandidate(queuedCandidate);
                    }
                }
            } else {
                iceCandidateQueueRef.current.push(candidate);
            }
        } else if (signal.sdp) {
            if (signal.sdp.type === 'offer') {
                if (pc) {
                    console.warn("WebRTC glare condition detected. Ignoring incoming offer.");
                    return;
                }

                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                setLocalStream(stream);
                setIsCallActive(true);

                const newPc = setupPeerConnection(stream);
                await newPc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
                
                const answer = await newPc.createAnswer();
                await newPc.setLocalDescription(answer);
                sendSignal({ sdp: answer });

            } else if (signal.sdp.type === 'answer') {
                if (!pc) {
                    console.error("Received an answer but no peer connection exists.");
                    return;
                }
                await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
            }
            
            // リモートディスクリプション設定後、キューに入れられた候補を処理
            const currentPc = peerConnectionRef.current;
            if (currentPc) {
                while(iceCandidateQueueRef.current.length > 0) {
                    const candidate = iceCandidateQueueRef.current.shift();
                    if (candidate) {
                       await currentPc.addIceCandidate(candidate);
                    }
                }
            }
        }
    } catch (err) {
        console.error("Signal handling error:", err);
        setError(`ビデオ接続エラー: ${err instanceof Error ? err.message : '不明なエラーが発生しました。'}`);
    }
  };

  useEffect(() => {
    const mainVideo = mainVideoRef.current;
    const pipVideo = pipVideoRef.current;

    if (!isCallActive || !mainVideo) return;
  
    // 通話がアクティブな場合のみストリームを設定
    let mainStream: MediaStream | null = null;
    let pipStream: MediaStream | null = null;
  
    if (remoteStream) {
      // 通話相手がいる場合
      mainStream = isSharingScreen ? localStream : remoteStream;
      pipStream = isSharingScreen ? remoteStream : localStream;
    } else {
      // 待機中の場合
      mainStream = localStream; // メインに自分の映像を表示
      pipStream = null; // PiPは非表示
    }
  
    if (mainVideo.srcObject !== mainStream) {
      mainVideo.srcObject = mainStream;
    }
  
    if (pipVideo) {
      if (pipVideo.srcObject !== pipStream) {
        pipVideo.srcObject = pipStream;
      }
      // PiPストリームがない場合は非表示にする
      pipVideo.style.display = pipStream ? 'block' : 'none';
    }
  }, [localStream, remoteStream, isSharingScreen, isCallActive]);
  
  useEffect(() => {
    if (!session) return;
    webRtcChannelRef.current = supabase.channel(`webrtc-room-${ROOM_ID}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'webrtc_signals', filter: `room=eq.${ROOM_ID}` }, handleSignal)
      .subscribe((status, err) => {
          if (status === 'SUBSCRIBED') {
            console.log("✅ [WebRTC] Subscribed to 'webrtc_signals' channel.");
            if (error?.includes('webrtc_signals')) setError(null);
          } else if (status === 'CHANNEL_ERROR') {
            handleSubscriptionError(err, 'webrtc_signals');
          } else if (err) {
            console.error('⛔ [WebRTC] Subscription error', err);
          }
      });

    return () => {
      if (webRtcChannelRef.current) {
        supabase.removeChannel(webRtcChannelRef.current);
        webRtcChannelRef.current = null;
      }
    };
  }, [session, error]);

  const handleScreenCapture = async () => {
    if (typeof navigator.mediaDevices?.getDisplayMedia !== 'function') {
      setError("お使いのブラウザは画面キャプチャに対応していません。");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" } as any,
        audio: false,
      });
      
      const videoTrack = stream.getVideoTracks()[0];
      
      // ImageCapture APIを使用してフレームをキャプチャ
      const imageCapture = new (window as any).ImageCapture(videoTrack);
      
      await new Promise(resolve => setTimeout(resolve, 300)); // 画面が安定するのを待つ

      const bitmap = await imageCapture.grabFrame();
      
      // キャプチャ後すぐにストリームを停止
      videoTrack.stop();

      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(bitmap, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg');
        
        setCapturedImage(dataUrl);
        setCapturePrompt('');
        setIsCaptureModalOpen(true);
      } else {
          throw new Error("Canvasコンテキストの取得に失敗しました。");
      }
    } catch (err) {
      console.error("Screen capture failed:", err);
      if ((err as DOMException).name !== 'NotAllowedError' && (err as DOMException).name !== 'AbortError') {
        setError("画面のキャプチャに失敗しました。");
      }
    }
  };

  const handleCaptureFrame = () => {
    if (!mainVideoRef.current) return;
    const video = mainVideoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg');
      setCapturedImage(dataUrl);
      setCapturePrompt('');
      setIsCaptureModalOpen(true);
    } else {
      setError("フレームのキャプチャに失敗しました。");
    }
  };

  const handleSendCapturedFrame = async () => {
    if (!capturedImage || !capturePrompt.trim()) return;

    // Base64からFileオブジェクトを作成
    const base64Response = await fetch(capturedImage);
    const blob = await base64Response.blob();
    const imageFile = new File([blob], "capture.jpg", { type: "image/jpeg" });
    
    handleStandardMessage(capturePrompt, capturedImage, imageFile);

    setIsCaptureModalOpen(false);
    setCapturedImage(null);
    setCapturePrompt('');
  };

  const handleOpenManagementModal = async () => {
    if (!session) return;
    setIsPromptLoading(true);
    const userPrompts = await getPrompts(session.user.id);
    setPrompts(userPrompts);
    const currentActive = userPrompts.find(p => p.id === activePromptId) || userPrompts[0] || null;
    setSelectedPrompt(currentActive);
    // Also fetch demo questions when opening
    const userDemoQuestions = await getDemoQuestions(session.user.id);
    setDemoQuestions(userDemoQuestions);
    // Also ensure editable settings are up-to-date
    const userSettings = await getUserSettings(session.user.id);
    setEditableSettings(userSettings);
    // Fetch knowledge base entries
    const userKnowledgeEntries = await getKnowledgeBaseEntries(session.user.id);
    setKnowledgeBaseEntries(userKnowledgeEntries);
    setIsPromptLoading(false);
    setIsManagementModalOpen(true);
  };

  const handleCloseManagementModal = () => {
    setIsManagementModalOpen(false);
    setSelectedPrompt(null);
    setEditingDemoQuestion(null); // Close editing mode when modal closes
    setEditingKnowledgeEntry(null);
  };

  const handleNewPrompt = () => {
    setSelectedPrompt({ id: undefined, title: '新しいプロンプト', content: '' });
  };
  
  const handleSavePrompt = async () => {
    if (!session || !selectedPrompt || !selectedPrompt.title?.trim()) return;
    setIsPromptLoading(true);
    // Fix: Ensure the object passed to upsertPrompt matches the stricter `Insert` type.
    // This removes the explicit type annotation and ensures `content` is a string.
    const promptToSave = {
        ...selectedPrompt,
        user_id: session.user.id,
        title: selectedPrompt.title.trim(),
        content: selectedPrompt.content || '',
    };
    const savedPrompt = await upsertPrompt(promptToSave);

    if (savedPrompt) {
        setSnackbar({ open: true, message: 'プロンプトを保存しました。', severity: 'success' });
        const updatedPrompts = await getPrompts(session.user.id);
        setPrompts(updatedPrompts);
        // If it was a new prompt, make it the selected one
        if (!selectedPrompt.id) {
            setSelectedPrompt(savedPrompt);
        }
    } else {
        setSnackbar({ open: true, message: 'プロンプトの保存に失敗しました。', severity: 'error' });
    }
    setIsPromptLoading(false);
  };

  const handleSetActivePrompt = async (prompt: Prompt) => {
    if (!session || prompt.id === activePromptId) return;
    setIsPromptLoading(true);
    const { error } = await updateUserActivePrompt(prompt.id);
    if (error) {
        setSnackbar({ open: true, message: 'プロンプトの適用に失敗しました。', severity: 'error' });
    } else {
        setActivePromptId(prompt.id);
        setSystemPrompt(prompt.content);
        setSnackbar({ open: true, message: `プロンプト「${prompt.title}」を適用しました。`, severity: 'success' });
    }
    setIsPromptLoading(false);
  };
  
  const handleDeletePrompt = async (promptId: number) => {
      if (!session || !window.confirm("このプロンプトを本当に削除しますか？")) return;
      setIsPromptLoading(true);

      // If we are deleting the active prompt, we need to select a new one.
      if (promptId === activePromptId) {
          await updateUserActivePrompt(null); // Unset active prompt temporarily
          setActivePromptId(null);
      }

      const { error } = await deletePrompt(promptId);
      if (error) {
          setSnackbar({ open: true, message: 'プロンプトの削除に失敗しました。', severity: 'error' });
      } else {
          setSnackbar({ open: true, message: 'プロンプトを削除しました。', severity: 'success' });
          const updatedPrompts = await getPrompts(session.user.id);
          setPrompts(updatedPrompts);
          setSelectedPrompt(updatedPrompts[0] || null);

          // If there was no active prompt after deletion, re-initialize to set a new default.
          if (!activePromptId && updatedPrompts.length > 0) {
              await handleSetActivePrompt(updatedPrompts[0]);
          }
      }
      setIsPromptLoading(false);
  };

  const handleSaveSettings = async () => {
    if (!session) return;
    setIsPromptLoading(true);
    // Sync the main speech enabled state before saving
    setIsSpeechEnabled(editableSettings.is_speech_enabled ?? true);

    const { data, error } = await upsertUserSettings(editableSettings);
    if (error) {
        setSnackbar({ open: true, message: '設定の保存に失敗しました。', severity: 'error' });
    } else if (data) {
        setSettings(data);
        setSnackbar({ open: true, message: '設定を保存しました。', severity: 'success' });
    }
    setIsPromptLoading(false);
  };

  const handleAddDemoQuestion = async () => {
    if (!session || !newDemoQuestionText.trim()) return;
    setIsPromptLoading(true);
    const newQuestion = {
      user_id: session.user.id,
      question_text: newDemoQuestionText.trim(),
      sort_order: (demoQuestions.length > 0 ? Math.max(...demoQuestions.map(q => q.sort_order)) : 0) + 1,
    };
    const saved = await upsertDemoQuestion(newQuestion);
    if (saved) {
      setDemoQuestions([...demoQuestions, saved].sort((a,b) => a.sort_order - b.sort_order));
      setNewDemoQuestionText('');
      setSnackbar({ open: true, message: 'デモ質問を追加しました。', severity: 'success' });
    } else {
      setSnackbar({ open: true, message: '質問の追加に失敗しました。', severity: 'error' });
    }
    setIsPromptLoading(false);
  };

  const handleUpdateDemoQuestion = async () => {
    if (!session || !editingDemoQuestion || !editingDemoQuestion.question_text.trim()) return;
    setIsPromptLoading(true);
    
    const originalQuestion = demoQuestions.find(q => q.id === editingDemoQuestion.id);
    if (!originalQuestion) {
        setSnackbar({ open: true, message: '更新対象の質問が見つかりません。', severity: 'error' });
        setIsPromptLoading(false);
        return;
    }

    const questionToSave = {
        ...originalQuestion,
        question_text: editingDemoQuestion.question_text.trim()
    };

    const updated = await upsertDemoQuestion(questionToSave);
    
    if (updated) {
        setDemoQuestions(prev => 
            prev.map(q => (q.id === updated.id ? updated : q))
                .sort((a, b) => a.sort_order - b.sort_order)
        );
        setSnackbar({ open: true, message: 'デモ質問を更新しました。', severity: 'success' });
    } else {
        setSnackbar({ open: true, message: '質問の更新に失敗しました。', severity: 'error' });
    }
    setEditingDemoQuestion(null);
    setIsPromptLoading(false);
  };

  const handleDeleteDemoQuestion = async (questionId: number) => {
    if (!session || !window.confirm("このデモ質問を本当に削除しますか？")) return;
    setIsPromptLoading(true);
    const { error } = await deleteDemoQuestion(questionId);
    if (error) {
      setSnackbar({ open: true, message: '質問の削除に失敗しました。', severity: 'error' });
    } else {
      setDemoQuestions(demoQuestions.filter(q => q.id !== questionId));
      setSnackbar({ open: true, message: 'デモ質問を削除しました。', severity: 'success' });
    }
    setIsPromptLoading(false);
  };

  const handleGenerateDemoQuestions = () => {
    if (window.confirm("現在のプロンプトを使用してサイト情報から質問を自動生成します。生成された質問はリストの末尾に追加されます。よろしいですか？")) {
      handleConfirmGenerate();
    }
  };

  const handleConfirmGenerate = async () => {
    if (!session) return;

    setIsGeneratingQuestions(true);
    setSnackbar({ open: true, message: 'サイト情報を基に質問を生成中です... これには数分かかる場合があります。', severity: 'info' });

    try {
        // 1. GeminiにWeb検索を利用して質問リストの生成を依頼
        const prompt = generationPrompt.replace('{BASE_URL}', settings.search_base_url);
        
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: prompt,
            config: {
                tools: [{googleSearch: {}}],
            },
        });
        
        // レスポンスからJSON配列を抽出
        const responseText = response.text.trim();
        const jsonMatch = responseText.match(/\[.*\]/s);
        if (!jsonMatch) {
            console.error("AI Response (No JSON Array):", responseText);
            throw new Error("AIからの応答に有効なJSON配列が含まれていませんでした。");
        }

        const generatedQuestions = JSON.parse(jsonMatch[0]);
        if (!Array.isArray(generatedQuestions) || generatedQuestions.length === 0) {
            throw new Error("AIからの応答が期待した形式（空でない質問の配列）ではありませんでした。");
        }

        // 2. 既存の質問リストに追加するために、一件ずつ upsertDemoQuestion を呼び出す
        const maxSortOrder = demoQuestions.length > 0 ? Math.max(...demoQuestions.map(q => q.sort_order)) : 0;
        
        const newQuestions: DemoQuestion[] = [];
        for (let i = 0; i < generatedQuestions.length; i++) {
            const questionText = String(generatedQuestions[i]);
            if (questionText.trim()) {
                const newQuestionData = {
                    user_id: session.user.id,
                    question_text: questionText,
                    sort_order: maxSortOrder + i + 1,
                };
                const savedQuestion = await upsertDemoQuestion(newQuestionData);
                if (savedQuestion) {
                    newQuestions.push(savedQuestion);
                } else {
                    // 1件でも失敗したらループを中断し、エラーを報告
                    throw new Error(`質問「${questionText}」の登録に失敗しました。`);
                }
            }
        }
        
        // 3. UIを更新 (既存のリストに追加)
        setDemoQuestions(prev => [...prev, ...newQuestions].sort((a, b) => a.sort_order - b.sort_order));
        setSnackbar({ open: true, message: `${newQuestions.length}件の質問を自動生成し、リストに追加しました。`, severity: 'success' });

    } catch (err) {
        console.error('❌ [Demo Question Generation] Error:', err);
        let errorMessage = `エラーが発生しました: ${(err as Error).message}`;
        if ((err as Error).message.includes('JSON')) {
          errorMessage = 'AIからの応答を解析できませんでした。サイトの内容が複雑すぎるか、一時的なAIの問題の可能性があります。';
        } else {
            // エラーオブジェクトに response プロパティがあるかチェック
            const apiError = err as any;
            if (apiError.response) {
                errorMessage += ` (詳細: ${JSON.stringify(apiError.response)})`;
            }
        }
        setSnackbar({ open: true, message: errorMessage, severity: 'error' });
    } finally {
        setIsGeneratingQuestions(false);
    }
  };


  const handleToggleSpeech = async () => {
    const newIsEnabled = !isSpeechEnabled;
    setIsSpeechEnabled(newIsEnabled);

    if (!newIsEnabled) {
        window.speechSynthesis?.cancel();
        disconnectDidAgent();
        setSpeakingTranscript('');
    }
    
    if (session) {
        const updatedSettings: UserSettings = { ...editableSettings, is_speech_enabled: newIsEnabled };
        setEditableSettings(updatedSettings);
        setSettings(updatedSettings);
        await upsertUserSettings(updatedSettings);
    }
  };

  const handleAddKnowledgeEntry = async () => {
    if (!session || !newKnowledgeEntry.question.trim() || !newKnowledgeEntry.source_url.trim() || !newKnowledgeEntry.content_type.trim()) {
        setSnackbar({ open: true, message: 'すべてのフィールドを入力してください。', severity: 'error' });
        return;
    }
    setIsPromptLoading(true);
    const entryToSave = {
        user_id: session.user.id,
        ...newKnowledgeEntry,
    };
    const saved = await upsertKnowledgeBaseEntry(entryToSave);
    if (saved) {
        // Order might be different, refetch for consistency
        const updatedEntries = await getKnowledgeBaseEntries(session.user.id);
        setKnowledgeBaseEntries(updatedEntries);
        setNewKnowledgeEntry({ question: '', source_url: '', content_type: '' });
        setSnackbar({ open: true, message: 'ナレッジを追加しました。', severity: 'success' });
    } else {
        setSnackbar({ open: true, message: 'ナレッジの追加に失敗しました。', severity: 'error' });
    }
    setIsPromptLoading(false);
  };

  const handleUpdateKnowledgeEntry = async () => {
    if (!session || !editingKnowledgeEntry || !editingKnowledgeEntry.question.trim() || !editingKnowledgeEntry.source_url.trim() || !editingKnowledgeEntry.content_type.trim()) {
        setSnackbar({ open: true, message: 'すべてのフィールドを入力してください。', severity: 'error' });
        return;
    }
    setIsPromptLoading(true);
    const updated = await upsertKnowledgeBaseEntry(editingKnowledgeEntry);
    if (updated) {
        setKnowledgeBaseEntries(prev => prev.map(e => e.id === updated.id ? updated : e));
        setEditingKnowledgeEntry(null);
        setSnackbar({ open: true, message: 'ナレッジを更新しました。', severity: 'success' });
    } else {
        setSnackbar({ open: true, message: 'ナレッジの更新に失敗しました。', severity: 'error' });
    }
    setIsPromptLoading(false);
  };

  const handleDeleteKnowledgeEntry = async (entryId: number) => {
    if (!session || !window.confirm("このナレッジを本当に削除しますか？")) return;
    setIsPromptLoading(true);
    const { error } = await deleteKnowledgeBaseEntry(entryId);
    if (error) {
        setSnackbar({ open: true, message: 'ナレッジの削除に失敗しました。', severity: 'error' });
    } else {
        setKnowledgeBaseEntries(prev => prev.filter(e => e.id !== entryId));
        setSnackbar({ open: true, message: 'ナレッジを削除しました。', severity: 'success' });
    }
    setIsPromptLoading(false);
  };
  
  const handleRegisterDemoQuestionsToZendesk = async () => {
    if (demoQuestions.length === 0) {
        setSnackbar({ open: true, message: '登録するデモ質問がありません。', severity: 'error' });
        return;
    }
    setIsPromptLoading(true);
    setSnackbar({ open: true, message: `Zendeskに${demoQuestions.length}件のチケットを登録しています...`, severity: 'info' });

    let successCount = 0;
    let errorCount = 0;

    for (const question of demoQuestions) {
        try {
            const { data, error } = await supabase.functions.invoke('zendesk-create-ticket', {
                body: {
                    subdomain: settings.zendesk_subdomain,
                    email: settings.zendesk_user_email,
                    token: settings.zendesk_api_token,
                    subject: `AIアシスタントからのナレッジ登録: ${question.question_text.substring(0, 50)}`,
                    comment: `自動デモ機能で利用される以下の質問がナレッジとして登録されました。\n\n---\n\n${question.question_text}`
                },
            });

            if (error) throw error;
            if (data.error) throw new Error(data.error);
            
            successCount++;

        } catch (err) {
            console.error(`Failed to create Zendesk ticket for question ID ${question.id}:`, err);
            errorCount++;
        }
    }
    
    setIsPromptLoading(false);
    if (errorCount > 0) {
        setSnackbar({ open: true, message: `${successCount}件のチケット作成に成功、${errorCount}件は失敗しました。`, severity: 'warning' });
    } else {
        setSnackbar({ open: true, message: `${successCount}件のチケットをZendeskに正常に登録しました。`, severity: 'success' });
    }
  };

  const handleCloseSnackbar = (event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    setSnackbar({ ...snackbar, open: false });
  };

  const renderLogin = () => (
    <Container component="main" maxWidth="xs" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <Paper elevation={6} sx={{ padding: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', borderRadius: '16px' }}>
        <Avatar sx={{ m: 1, bgcolor: 'secondary.main' }}>
          <LockOutlined />
        </Avatar>
        <Typography component="h1" variant="h5">
          {authView === 'sign_in' ? 'ログイン' : '新規登録'}
        </Typography>
        <Box component="form" onSubmit={authView === 'sign_in' ? handleSignIn : handleSignUp} sx={{ mt: 1, width: '100%' }}>
          <TextField
            margin="normal"
            required
            fullWidth
            id="email"
            label="メールアドレス"
            name="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            name="password"
            label="パスワード"
            type="password"
            id="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {authError && <Alert severity="error" sx={{ width: '100%', mt: 2, whiteSpace: 'pre-wrap' }}>{authError}</Alert>}
          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 3, mb: 2 }}
            disabled={isAuthLoading}
          >
            {isAuthLoading ? <CircularProgress size={24} color="inherit" /> : (authView === 'sign_in' ? 'ログイン' : '登録する')}
          </Button>
          {showResend && authView === 'sign_in' && (
            <Button
              fullWidth
              variant="outlined"
              sx={{ mb: 2 }}
              onClick={handleResendConfirmation}
              disabled={isAuthLoading}
            >
              {isAuthLoading ? <CircularProgress size={24} /> : '確認メールを再送信'}
            </Button>
          )}
           <Link href="#" variant="body2" onClick={(e) => {
              e.preventDefault();
              setAuthView(authView === 'sign_in' ? 'sign_up' : 'sign_in');
              setAuthError(null);
              setShowResend(false);
          }}>
            {authView === 'sign_in' ? "アカウントをお持ちでないですか？ 新規登録" : "すでにアカウントをお持ちですか？ ログイン"}
          </Link>
        </Box>
      </Paper>
    </Container>
  );

  const latestModelMessage = messages.slice().reverse().find(m => m.role === 'model')?.text || null;
  const uniqueLangs = Array.from(new Set(availableVoices.map(v => v.lang))).sort();
  const filteredVoices = availableVoices.filter(v => v.lang === (editableSettings.voice_lang || 'ja-JP'));


  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {!session ? renderLogin() : (
      <>
        <Box sx={{ display: 'flex', height: '100vh', flexDirection: 'column' }}>
          
          {/* --- TOP LEVEL APP BAR (REFACTORED FOR RESPONSIVENESS) --- */}
          <AppBar position="static" sx={{ bgcolor: 'background.paper', boxShadow: 1, borderBottom: '1px solid', borderColor: 'grey.200' }}>
            <Toolbar>
                <Box sx={{ flex: 1, display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: 1 }}>
                    <Stack direction="row" spacing={1} sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center' }}>
                         <Paper
                            sx={{
                            p: '2px 8px',
                            display: 'flex',
                            alignItems: 'center',
                            borderRadius: '8px',
                            boxShadow: 2,
                            bgcolor: 'background.paper'
                            }}
                        >
                            <TextField
                            value={dbTestInput}
                            onChange={(e) => setDbTestInput(e.target.value)}
                            placeholder="チャットで質問を送信..."
                            variant="standard"
                            size="small"
                            sx={{
                                width: '150px',
                                '& .MuiInputBase-root': { fontSize: '0.75rem', padding: '4px 8px' },
                                '& .MuiInput-underline:before': { borderBottom: 'none' },
                                '& .MuiInput-underline:after': { borderBottom: 'none' },
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                e.preventDefault();
                                testSupabaseTable();
                                }
                            }}
                            />
                            <Divider sx={{ height: 20, m: 0.5 }} orientation="vertical" />
                            {/* Fix: Bypassing incorrect type definition that reports a missing 'children' prop. */}
                            {/* @ts-ignore */}
                            <Tooltip title="DB経由で質問を送信">
                            <IconButton color="primary" sx={{ p: '4px' }} onClick={testSupabaseTable}>
                                <Send fontSize="small" />
                            </IconButton>
                            </Tooltip>
                        </Paper>
                        <FormControlLabel
                            control={<Switch checked={isDemoMode} onChange={(e) => setIsDemoMode(e.target.checked)} />}
                            label="自動デモ"
                            sx={{
                                bgcolor: 'background.paper',
                                px: 1,
                                borderRadius: 2,
                                boxShadow: 2,
                                '& .MuiTypography-root': { fontSize: '0.8rem' },
                            }}
                        />
                        {isDemoMode && <Chip label={`残り: ${waitingCount}`} size="small" variant="outlined" />}
                    </Stack>
                </Box>

                <Typography variant="h6" component="div" sx={{ color: 'text.primary', display: { xs: 'none', md: 'block' } }}>
                    Refa-sta AI Assistant
                </Typography>
                
                <Box sx={{ flex: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1 }}>
                    {/* @ts-ignore */}
                    <Tooltip title={isChatVisible ? "チャットパネルを非表示" : "チャットパネルを表示"}>
                      <IconButton onClick={() => setIsChatVisible(!isChatVisible)} color={isChatVisible ? "primary" : "default"}>
                        <Forum />
                      </IconButton>
                    </Tooltip>
                    {/* @ts-ignore */}
                    <Tooltip title={isIframeVisible ? "サイトプレビューを非表示" : "サイトプレビューを表示"}>
                      <IconButton onClick={() => setIsIframeVisible(!isIframeVisible)} color={isIframeVisible ? "primary" : "default"}>
                        <Search />
                      </IconButton>
                    </Tooltip>
                    {/* @ts-ignore */}
                    <Tooltip title={avatarMode === 'did' ? "Chromeボイスモードに切り替え" : "D-IDアバターモードに切り替え"}>
                        <IconButton onClick={() => setAvatarMode(prev => prev === 'did' ? 'chrome' : 'did')} color={avatarMode === 'did' ? "primary" : "default"}>
                            <SmartToy />
                        </IconButton>
                    </Tooltip>
                    {/* @ts-ignore */}
                    <Tooltip title={isSpeechEnabled ? "AIの音声をミュート" : "AIの音声のミュートを解除"}>
                        <IconButton onClick={handleToggleSpeech} color={isSpeechEnabled ? "primary" : "default"}>
                            {isSpeechEnabled ? <VolumeUp /> : <VolumeOff />}
                        </IconButton>
                    </Tooltip>
                    {/* @ts-ignore */}
                    <Tooltip title="設定">
                        <IconButton onClick={handleOpenManagementModal}>
                            <Settings />
                        </IconButton>
                    </Tooltip>
                    <Chip
                        avatar={<Avatar sx={{ bgcolor: deepOrange[500] }}>{session.user.email?.[0].toUpperCase()}</Avatar>}
                        label={session.user.email}
                        variant="outlined"
                        sx={{ display: { xs: 'none', sm: 'flex' } }}
                    />
                    <Button variant="text" size="small" onClick={() => {
                        supabase.auth.signOut();
                        setMessages([]);
                        setIframeUrl('https://kinkaimasu.jp');
                        setSettings(DEFAULT_SETTINGS);
                        setSystemPrompt(DEFAULT_SYSTEM_PROMPT.content);
                    }}>
                    ログアウト
                    </Button>
                </Box>
            </Toolbar>
          </AppBar>
          
          {/* --- MAIN CONTENT (REFACTORED FOR 3-COLUMN LAYOUT) --- */}
          <Box sx={{ 
              display: 'flex', 
              flex: 1, 
              overflow: 'hidden', 
              flexDirection: { xs: 'column', md: 'row' } 
          }}>
            
            {/* --- LEFT PANEL (AI CHARACTER) --- */}
            <Box sx={{ 
                width: '100%',
                height: { xs: '300px', md: 'auto' },
                flex: { md: (isChatVisible || isIframeVisible) ? '1 1 50%' : '1 1 100%' },
                position: 'relative', 
                bgcolor: 'black', 
                overflow: 'hidden',
                transition: 'flex 0.3s ease-in-out',
            }}>
                <AiCharacter 
                    isLoading={loading}
                    characterImageUrl={settings.character_image_url}
                    backgroundImageUrl={settings.background_image_url}
                    latestUserQuestion={latestUserQuestion}
                    speakingTranscript={speakingTranscript}
                    isDemoMode={isDemoMode}
                    demoQuestions={demoQuestions.map(q => q.question_text)}
                    currentDemoQuestionIndex={demoQuestionIndexRef.current}
                    avatarMode={avatarMode}
                    stream={stream}
                    isDidAgentConnected={isDidAgentConnected}
                    telopFontFamily={settings.telop_font_family}
                    telopFontSize={settings.telop_font_size}
                />
              
              {/* Call Controls */}
              {isCallActive ? (
                <Box sx={{
                  position: 'absolute',
                  bottom: '20px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  display: 'flex',
                  gap: 2,
                  bgcolor: 'rgba(0,0,0,0.6)',
                  p: 1.5,
                  borderRadius: '50px',
                  zIndex: 10
                }}>
                  <Fab color={isMicMuted ? "default" : "primary"} size="medium" onClick={toggleMic}>
                    {isMicMuted ? <MicOff /> : <Mic />}
                  </Fab>
                  <Fab color={isSharingScreen ? "primary" : "default"} size="medium" onClick={shareScreen}>
                    <ScreenShare />
                  </Fab>
                  <Fab color="secondary" size="medium" onClick={handleCaptureFrame}>
                    <Screenshot />
                  </Fab>
                  <Fab color="error" size="medium" onClick={hangUp}>
                    <CallEnd />
                  </Fab>
                </Box>
              ) : (
                 <Box sx={{
                  position: 'absolute',
                  bottom: '20px',
                  left: '20px',
                  display: 'flex',
                  gap: 1,
                  zIndex: 10
                 }}>
                    {/* @ts-ignore */}
                    <Tooltip title="担当者とビデオ通話を開始">
                      <Fab color="primary" aria-label="call" onClick={handleInitiateCall}>
                        <Videocam />
                      </Fab>
                    </Tooltip>
                    {/* @ts-ignore */}
                    <Tooltip title="見ている画面について質問">
                      <Fab color="secondary" aria-label="screenshot" onClick={handleScreenCapture}>
                        <Screenshot />
                      </Fab>
                    </Tooltip>
                 </Box>
              )}
            </Box>

            {/* --- MIDDLE PANEL (CHAT) --- */}
            {isChatVisible && (
              <Box sx={{
                  width: { xs: '100%', md: 'auto' },
                  flex: { xs: 1, md: isIframeVisible ? '1 1 25%' : '1 1 50%' },
                  minWidth: { md: '400px' },
                  minHeight: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  borderLeft: { xs: 'none', md: '1px solid' },
                  borderTop: { xs: '1px solid', md: 'none' },
                  borderColor: 'grey.300',
                  transition: 'flex 0.3s ease-in-out',
                  bgcolor: 'background.paper'
              }}>
                {/* This Box now solely contains the chat logic */}
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
                        {messages.map((msg, index) => (
                          <Box key={index} sx={{ mb: 2, display: 'flex', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
                              <Avatar sx={{ bgcolor: msg.role === 'user' ? 'primary.main' : 'secondary.main', ml: msg.role === 'user' ? 1.5 : 0, mr: msg.role === 'user' ? 0 : 1.5 }}>
                                  {msg.role === 'user' ? <Person /> : <img src={settings.character_image_url} alt="AI" style={{width: '100%', height: '100%'}}/>}
                              </Avatar>
                              <Paper
                                elevation={0}
                                sx={{
                                    p: 1.5,
                                    bgcolor: msg.role === 'user' ? 'primary.main' : '#f0f0f0',
                                    color: msg.role === 'user' ? 'primary.contrastText' : 'text.primary',
                                    borderRadius: '16px',
                                    maxWidth: 'calc(100% - 58px)',
                                    position: 'relative',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                                    // User bubble style with tail
                                    ...(msg.role === 'user' && {
                                        borderTopRightRadius: '4px',
                                        '&::after': {
                                            content: '""',
                                            position: 'absolute',
                                            top: '15px',
                                            right: '-8px',
                                            width: 0,
                                            height: 0,
                                            borderTop: '8px solid transparent',
                                            borderBottom: '8px solid transparent',
                                            borderLeft: (theme) => `8px solid ${theme.palette.primary.main}`,
                                        }
                                    }),
                                    // AI/model bubble style with tail
                                    ...(msg.role === 'model' && {
                                        borderTopLeftRadius: '4px',
                                        '&::after': {
                                            content: '""',
                                            position: 'absolute',
                                            top: '15px',
                                            left: '-8px',
                                            width: 0,
                                            height: 0,
                                            borderTop: '8px solid transparent',
                                            borderBottom: '8px solid transparent',
                                            borderRight: '8px solid #f0f0f0',
                                        }
                                    }),
                                }}
                              >
                                  {msg.image && (
                                    <Box
                                      component="img"
                                      src={msg.image}
                                      alt="添付画像"
                                      sx={{
                                        maxWidth: '100%',
                                        maxHeight: '200px',
                                        borderRadius: '8px',
                                        mb: msg.text ? 1 : 0,
                                        cursor: 'pointer'
                                      }}
                                      onClick={() => { setIframeUrl(msg.image!); setIsIframeModalOpen(true); }}
                                    />
                                  )}
                                  <Box className="markdown-content">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
                                  </Box>
                                  {msg.citations && msg.citations.length > 0 && (
                                      <Box sx={{ mt: 1, borderTop: '1px solid', borderColor: 'divider', pt: 1 }}>
                                          <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: msg.role === 'user' ? 'grey.300' : 'text.secondary' }}>
                                            <InfoOutlined fontSize="inherit" /> 参照元:
                                          </Typography>
                                          <Stack direction="column" spacing={0.5} sx={{ mt: 0.5 }}>
                                            {msg.citations.map((cite, i) => (
                                                <Link 
                                                    href={cite.uri} 
                                                    key={i} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer" 
                                                    variant="caption"
                                                    sx={{
                                                        display: 'block',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap',
                                                    }}
                                                    onClick={(e) => { e.preventDefault(); setIframeUrl(cite.uri); }}
                                                >
                                                  {cite.title || cite.uri}
                                                </Link>
                                            ))}
                                          </Stack>
                                      </Box>
                                  )}
                              </Paper>
                          </Box>
                        ))}
                        {loading && (
                            <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
                                <Avatar sx={{ bgcolor: 'secondary.main', mr: 1.5 }}>
                                    <img src={settings.character_image_url} alt="AI" style={{width: '100%', height: '100%'}}/>
                                </Avatar>
                                <Paper elevation={2} sx={{ p: 1.5, borderRadius: '16px', borderTopLeftRadius: '4px', display: 'inline-flex', alignItems: 'center' }}>
                                    <CircularProgress size={20} />
                                    <Typography sx={{ ml: 2 }}>AIが思考中...</Typography>
                                </Paper>
                            </Box>
                        )}
                        <div ref={chatEndRef} />
                    </Box>

                    {/* --- INPUT AREA --- */}
                    <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'grey.300', bgcolor: 'background.paper' }}>
                        {settings.is_vertex_ai_search_enabled && (
                            <Chip
                                icon={<AutoAwesome />}
                                label="Vertex AI Searchモード"
                                size="small"
                                color="secondary"
                                sx={{ mb: 1 }}
                            />
                        )}
                        {!hasUserSentMessage && (
                          <Box sx={{ mb: 1, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {EXAMPLE_PROMPTS.map((prompt, i) => (
                              <Chip key={i} label={prompt} variant="outlined" onClick={() => handleExamplePromptClick(prompt)} />
                            ))}
                          </Box>
                        )}
                         {error && (
                            <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 1, whiteSpace: 'pre-wrap' }}>
                                {error}
                            </Alert>
                        )}
                        <Box component="form" onSubmit={handleFormSubmit} onPaste={handlePaste}>
                            <Paper
                                elevation={2}
                                sx={{
                                    p: '4px 8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    borderRadius: '12px'
                                }}
                            >
                                <FormControlLabel
                                  control={
                                    <Switch
                                      size="small"
                                      checked={isImageGenerationMode}
                                      onChange={(e) => setIsImageGenerationMode(e.target.checked)}
                                      icon={<ImageIcon />}
                                      checkedIcon={<ImageIcon color="primary"/>}
                                    />
                                  }
                                  label={isImageGenerationMode ? "画像生成" : ""}
                                  labelPlacement="start"
                                  sx={{ mr: 0.5, '& .MuiTypography-root': { fontSize: '0.8rem', color: isImageGenerationMode ? 'primary.main' : 'text.secondary' } }}
                                />
                                <TextField
                                    fullWidth
                                    variant="standard"
                                    placeholder={isImageGenerationMode ? "生成したい画像の説明を入力..." : "メッセージを入力、または画像をペースト..."}
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    disabled={loading || isDemoMode}
                                    multiline
                                    maxRows={5}
                                    sx={{
                                        '& .MuiInput-underline:before': { borderBottom: 'none' },
                                        '& .MuiInput-underline:after': { borderBottom: 'none' },
                                        '& .MuiInputBase-root': { padding: '4px' },
                                    }}
                                />
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={handleImageChange}
                                  ref={fileInputRef}
                                  className="hidden"
                                />
                                {/* @ts-ignore */}
                                <Tooltip title={isListening ? "音声入力を停止" : "音声で入力"}>
                                  <IconButton
                                    color={isListening ? "error" : "primary"}
                                    onClick={handleToggleListening}
                                    disabled={loading || isDemoMode}
                                  >
                                    <Mic />
                                  </IconButton>
                                </Tooltip>
                                {/* @ts-ignore */}
                                <Tooltip title="画像を添付">
                                  <IconButton color="primary" onClick={() => fileInputRef.current?.click()} disabled={loading || isDemoMode || isImageGenerationMode}>
                                    <AttachFile />
                                  </IconButton>
                                </Tooltip>
                                {/* @ts-ignore */}
                                <Tooltip title="動画を生成 (Veo 3)">
                                    <IconButton color="secondary" onClick={() => setIsVideoModalOpen(true)} disabled={loading || isDemoMode}>
                                        <Movie />
                                    </IconButton>
                                </Tooltip>
                                <Divider sx={{ height: 28, m: 0.5 }} orientation="vertical" />
                                {/* @ts-ignore */}
                                <Tooltip title="送信">
                                  <IconButton
                                      color="primary"
                                      type="submit"
                                      disabled={(!input.trim() && !image && !youtubeUrl.trim()) || loading || isDemoMode}
                                  >
                                      <Send />
                                  </IconButton>
                                </Tooltip>
                            </Paper>
                        </Box>
                        {youtubeUrl && (
                          <Chip
                              icon={<YouTube />}
                              label="YouTube動画を処理"
                              onDelete={() => setYoutubeUrl('')}
                              color="error"
                              sx={{ mt: 1, width: '100%' }}
                          />
                        )}
                        {image && (
                          <Chip
                              icon={<ImageIcon />}
                              label={imageFile?.name || '添付画像'}
                              onDelete={removeImage}
                              color="secondary"
                              sx={{ mt: 1 }}
                          />
                        )}
                    </Box>
                </Box>
              </Box>
            )}

            {/* --- RIGHT PANEL (IFRAME) --- */}
            {isIframeVisible && (
              <Box sx={{
                  width: { xs: '100%', md: 'auto' },
                  flex: { xs: 1, md: isChatVisible ? '1 1 25%' : '1 1 50%' },
                  minWidth: { md: '400px' },
                  minHeight: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  borderLeft: { xs: 'none', md: '1px solid' },
                  borderTop: { xs: '1px solid', md: 'none' },
                  borderColor: 'grey.300',
                  transition: 'flex 0.3s ease-in-out',
              }}>
                  <Paper
                      elevation={0}
                      sx={{
                          p: '4px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          borderBottom: '1px solid',
                          borderColor: 'grey.200',
                          gap: 1
                      }}
                  >
                    <Search sx={{ color: 'text.secondary' }} />
                    <Typography variant="body2" sx={{ flexGrow: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {searchStatus === 'searching' && <CircularProgress size={16} sx={{ mr: 1 }}/>}
                        {searchStatus === 'found' && '✅ '}
                        {searchStatus === 'fallback' && '⚠️ '}
                        <Link href={iframeUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => { e.preventDefault(); setIsIframeModalOpen(true); }}>
                          {(searchStatus === 'idle' && !hasUserSentMessage) ? "参考サイト: kinkaimasu.jp" : (latestUserQuestion || "検索結果")}
                        </Link>
                    </Typography>
                    {/* @ts-ignore */}
                    <Tooltip title="別ウィンドウで開く">
                      <IconButton size="small" onClick={() => window.open(iframeUrl, '_blank')}>
                         <InfoOutlined fontSize="small"/>
                      </IconButton>
                    </Tooltip>
                  </Paper>
                  <iframe
                      src={iframeUrl}
                      title="Search Results"
                      style={{ width: '100%', height: '100%', border: 'none' }}
                      sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                  />
              </Box>
            )}

          </Box>
        </Box>
        
        {/* --- MODALS --- */}
        <Dialog open={isIframeModalOpen} onClose={() => setIsIframeModalOpen(false)} fullWidth maxWidth="lg" PaperProps={{ sx: { height: '90vh' } }}>
          <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              Webサイト
              <IconButton onClick={() => setIsIframeModalOpen(false)}><Close /></IconButton>
          </DialogTitle>
          <DialogContent sx={{ p: 0, overflow: 'hidden' }}>
            <iframe
              src={iframeUrl}
              title="Full Screen Search"
              style={{ width: '100%', height: '100%', border: 'none' }}
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            />
          </DialogContent>
        </Dialog>
        
        {/* --- Video Generation Modal (Veo) --- */}
        <Dialog open={isVideoModalOpen} onClose={() => { if(!isVideoGenerating) setIsVideoModalOpen(false); }} fullWidth maxWidth="sm">
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Movie color="secondary" />
                動画生成 (Veo 3)
            </DialogTitle>
            <DialogContent>
                <DialogContentText sx={{ mb: 2 }}>
                    テキストから高品質な動画を生成します。生成には数分かかる場合があります。<br/>
                    ※有料のAPIキー設定が必要です。
                </DialogContentText>
                
                {videoError && (
                    <Alert severity="error" sx={{ mb: 2 }} onClose={() => setVideoError(null)}>
                        {videoError}
                    </Alert>
                )}

                <TextField
                    autoFocus
                    margin="dense"
                    id="video-prompt"
                    label="どのような動画を作成しますか？"
                    type="text"
                    fullWidth
                    multiline
                    rows={3}
                    variant="outlined"
                    value={videoPrompt}
                    onChange={(e) => setVideoPrompt(e.target.value)}
                    disabled={isVideoGenerating}
                    placeholder="例: 高速道路を走る近未来的な車のネオンホログラム"
                    sx={{ mb: 3 }}
                />

                <Typography variant="body2" color="text.secondary" gutterBottom>
                    アスペクト比
                </Typography>
                <ToggleButtonGroup
                    value={videoAspectRatio}
                    exclusive
                    onChange={(e, newAlignment) => { if(newAlignment) setVideoAspectRatio(newAlignment); }}
                    fullWidth
                    disabled={isVideoGenerating}
                    sx={{ mb: 3 }}
                >
                    <ToggleButton value="16:9">
                        16:9 (横長)
                    </ToggleButton>
                    <ToggleButton value="9:16">
                        9:16 (縦長)
                    </ToggleButton>
                </ToggleButtonGroup>

                {isVideoGenerating && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 3 }}>
                        <CircularProgress size={48} sx={{ mb: 2 }} />
                        <Typography variant="body1">動画を生成しています...</Typography>
                        <Typography variant="caption" color="text.secondary">この処理には数分かかることがあります。ウィンドウを閉じないでください。</Typography>
                    </Box>
                )}

                {generatedVideoUrl && !isVideoGenerating && (
                    <Box sx={{ mt: 2 }}>
                        <Typography variant="subtitle2" gutterBottom>生成された動画:</Typography>
                        <video 
                            src={generatedVideoUrl} 
                            controls 
                            autoPlay 
                            loop 
                            style={{ width: '100%', borderRadius: '8px', border: '1px solid #ddd' }} 
                        />
                        <Button 
                            variant="outlined" 
                            href={generatedVideoUrl} 
                            download={`veo-video-${Date.now()}.mp4`}
                            fullWidth
                            sx={{ mt: 1 }}
                        >
                            ダウンロード
                        </Button>
                    </Box>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={() => setIsVideoModalOpen(false)} disabled={isVideoGenerating}>
                    閉じる
                </Button>
                <Button 
                    onClick={handleGenerateVideo} 
                    variant="contained" 
                    color="secondary" 
                    disabled={isVideoGenerating || !videoPrompt.trim()}
                    startIcon={!isVideoGenerating && <Movie />}
                >
                    生成する
                </Button>
            </DialogActions>
        </Dialog>

        {/* --- WebRTC Call Modal --- */}
        <Dialog open={isCallActive} fullScreen>
            <Box sx={{ position: 'relative', width: '100%', height: '100%', bgcolor: 'black' }}>
                <video ref={mainVideoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                <video ref={pipVideoRef} autoPlay playsInline muted style={{
                    position: 'absolute',
                    bottom: '20px',
                    right: '20px',
                    width: '20%',
                    maxWidth: '240px',
                    borderRadius: '8px',
                    border: '2px solid white',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                    display: 'none'
                }} />

                <AppBar position="absolute" sx={{ background: 'transparent', boxShadow: 'none' }}>
                    <Toolbar>
                        <Typography variant="h6" sx={{ flexGrow: 1 }}>
                            担当者と通話中...
                        </Typography>
                    </Toolbar>
                </AppBar>

                {/* Call Controls inside the full screen modal */}
                 <Box sx={{
                  position: 'absolute',
                  bottom: '20px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  display: 'flex',
                  gap: 2,
                  bgcolor: 'rgba(0,0,0,0.6)',
                  p: 1.5,
                  borderRadius: '50px',
                  zIndex: 10
                }}>
                  <Fab color={isMicMuted ? "default" : "primary"} size="medium" onClick={toggleMic}>
                    {isMicMuted ? <MicOff /> : <Mic />}
                  </Fab>
                   <Fab color={isSharingScreen ? "primary" : "default"} size="medium" onClick={shareScreen}>
                    <ScreenShare />
                  </Fab>
                   <Fab color="secondary" size="medium" onClick={handleCaptureFrame}>
                    <Screenshot />
                  </Fab>
                  <Fab color="error" size="medium" onClick={hangUp}>
                    <CallEnd />
                  </Fab>
                </Box>
            </Box>
        </Dialog>

        {/* --- Contact initiation modal --- */}
        <Dialog open={isContactModalOpen} onClose={() => setIsContactModalOpen(false)}>
            <DialogTitle>担当者とのビデオ通話</DialogTitle>
            <DialogContent>
                <DialogContentText>
                    担当者を呼び出して、ビデオ通話を開始しますか？
                    <br />
                    カメラとマイクの使用許可を求められます。
                </DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button onClick={() => setIsContactModalOpen(false)}>キャンセル</Button>
                <Button onClick={() => { setIsContactModalOpen(false); startCall(); }} variant="contained">
                    通話を開始
                </Button>
            </DialogActions>
        </Dialog>

        {/* --- Capture Modal --- */}
        <Dialog open={isCaptureModalOpen} onClose={() => setIsCaptureModalOpen(false)} fullWidth maxWidth="md">
            <DialogTitle>キャプチャした画像について質問</DialogTitle>
            <DialogContent>
                <DialogContentText sx={{ mb: 2 }}>
                    以下の画像について、AIに質問する内容を入力してください。
                </DialogContentText>
                <Box
                    component="img"
                    src={capturedImage}
                    alt="Screen capture"
                    sx={{ width: '100%', maxHeight: '400px', objectFit: 'contain', border: '1px solid', borderColor: 'grey.300', mb: 2 }}
                />
                <TextField
                    autoFocus
                    margin="dense"
                    id="capture-prompt"
                    label="質問内容"
                    type="text"
                    fullWidth
                    variant="outlined"
                    value={capturePrompt}
                    onChange={(e) => setCapturePrompt(e.target.value)}
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={() => setIsCaptureModalOpen(false)}>キャンセル</Button>
                <Button onClick={handleSendCapturedFrame} variant="contained" disabled={!capturePrompt.trim()}>質問する</Button>
            </DialogActions>
        </Dialog>

        {/* --- Management Modal --- */}
        <Dialog open={isManagementModalOpen} onClose={handleCloseManagementModal} fullWidth maxWidth="lg">
            <DialogTitle sx={{ borderBottom: 1, borderColor: 'divider' }}>
                設定 & プロンプト管理
                <IconButton onClick={handleCloseManagementModal} sx={{ position: 'absolute', right: 8, top: 8 }}>
                    <Close />
                </IconButton>
            </DialogTitle>
            <DialogContent sx={{ p: 0 }}>
                <Box sx={{ display: 'flex' }}>
                    <Tabs
                        orientation="vertical"
                        variant="scrollable"
                        value={managementTab}
                        onChange={(e, newValue) => setManagementTab(newValue)}
                        sx={{ borderRight: 1, borderColor: 'divider', minWidth: 160 }}
                    >
                        <Tab label="プロンプト" value="prompts" />
                        <Tab label="AI設定" value="settings" />
                        <Tab label="自動デモ管理" value="demo" />
                        <Tab label="ナレッジ管理" value="knowledge" />
                        <Tab label="高度な検索" value="advanced_search" />
                        <Tab label="Zendesk連携" value="zendesk" />
                    </Tabs>
                    {managementTab === 'prompts' && (
                        <Box sx={{ display: 'flex', flexGrow: 1 }}>
                            <List sx={{ width: '300px', borderRight: 1, borderColor: 'divider', overflowY: 'auto' }}>
                                <ListItemButton onClick={handleNewPrompt}>
                                    <ListItemIcon><Add /></ListItemIcon>
                                    <ListItemText primary="新しいプロンプトを作成" />
                                </ListItemButton>
                                <Divider />
                                {isPromptLoading ? <CircularProgress sx={{ m: 2 }} /> : prompts.map(prompt => (
                                    <ListItem
                                        key={prompt.id}
                                        secondaryAction={
                                            // @ts-ignore
                                            <Tooltip title="このプロンプトを有効化">
                                                <IconButton edge="end" onClick={() => handleSetActivePrompt(prompt)} disabled={prompt.id === activePromptId}>
                                                    <CheckCircle color={prompt.id === activePromptId ? 'success' : 'disabled'} />
                                                </IconButton>
                                            </Tooltip>
                                        }
                                        disablePadding
                                    >
                                        {/* Fix: Moved 'selected' prop to ListItemButton as it is not a valid prop for ListItem. */}
                                        <ListItemButton selected={selectedPrompt?.id === prompt.id} onClick={() => setSelectedPrompt(prompt)}>
                                            <ListItemText primary={prompt.title} />
                                        </ListItemButton>
                                    </ListItem>
                                ))}
                            </List>
                            <Box sx={{ p: 2, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                                {selectedPrompt ? (
                                    <>
                                        <TextField
                                            label="プロンプト名"
                                            value={selectedPrompt.title || ''}
                                            onChange={(e) => setSelectedPrompt(prev => ({...prev, title: e.target.value}))}
                                            fullWidth
                                            variant="outlined"
                                            sx={{ mb: 2 }}
                                        />
                                        <TextField
                                            label="プロンプト内容"
                                            value={selectedPrompt.content || ''}
                                            onChange={(e) => setSelectedPrompt(prev => ({ ...prev, content: e.target.value }))}
                                            fullWidth
                                            multiline
                                            rows={15}
                                            variant="outlined"
                                            sx={{ flexGrow: 1 }}
                                        />
                                        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                                            {selectedPrompt.id && (
                                                <Button
                                                    variant="outlined"
                                                    color="error"
                                                    startIcon={<Delete />}
                                                    onClick={() => handleDeletePrompt(selectedPrompt!.id!)}
                                                    disabled={isPromptLoading}
                                                >
                                                    削除
                                                </Button>
                                            )}
                                            <Button 
                                                variant="contained" 
                                                onClick={handleSavePrompt}
                                                disabled={isPromptLoading || !selectedPrompt.title?.trim()}
                                                startIcon={isPromptLoading ? <CircularProgress size={16} color="inherit" /> : <Edit />}
                                            >
                                                保存
                                            </Button>
                                        </Box>
                                    </>
                                ) : (
                                    <Typography>左のリストからプロンプトを選択するか、新規作成してください。</Typography>
                                )}
                            </Box>
                        </Box>
                    )}
                    {managementTab === 'settings' && (
                        <Box sx={{ p: 3, width: '100%' }}>
                            <Typography variant="h6" gutterBottom>AI音声設定</Typography>
                             <FormControlLabel
                                control={<Switch checked={editableSettings.is_speech_enabled} onChange={(e) => setEditableSettings(prev => ({...prev, is_speech_enabled: e.target.checked}))} />}
                                label="AIの音声読み上げを有効にする"
                            />
                            <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                                ※以下のピッチ・速度設定はChromeボイスモードでのみ有効です。
                            </Typography>
                             <Stack direction="row" spacing={2} sx={{ mt: 2, mb: 2 }}>
                                <FormControl fullWidth>
                                    <InputLabel id="voice-lang-select-label">言語</InputLabel>
                                    <Select
                                        labelId="voice-lang-select-label"
                                        value={editableSettings.voice_lang || ''}
                                        label="言語"
                                        onChange={(e) => setEditableSettings(prev => ({...prev, voice_lang: e.target.value, voice_name: null }))}
                                    >
                                        {uniqueLangs.map(lang => (
                                            <MenuItem key={lang} value={lang}>{lang}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                                <FormControl fullWidth disabled={!editableSettings.voice_lang || filteredVoices.length === 0}>
                                    <InputLabel id="voice-name-select-label">音声 (男性/女性など)</InputLabel>
                                    <Select
                                        labelId="voice-name-select-label"
                                        value={editableSettings.voice_name || ''}
                                        label="音声 (男性/女性など)"
                                        onChange={(e) => setEditableSettings(prev => ({...prev, voice_name: e.target.value}))}
                                    >
                                        <MenuItem value=""><em>ブラウザのデフォルト</em></MenuItem>
                                        {filteredVoices.map(voice => (
                                            <MenuItem key={voice.name} value={voice.name}>{voice.name}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Stack>
                            <Typography gutterBottom sx={{ mt: 2 }}>声の高さ (Pitch)</Typography>
                            <Slider
                                value={editableSettings.voice_pitch}
                                onChange={(e, newValue) => setEditableSettings(prev => ({...prev, voice_pitch: newValue as number}))}
                                aria-labelledby="pitch-slider"
                                valueLabelDisplay="auto"
                                step={0.01}
                                min={0.5}
                                max={2}
                            />
                            <Typography gutterBottom sx={{ mt: 2 }}>話す速度 (Rate)</Typography>
                             <Slider
                                value={editableSettings.voice_rate}
                                onChange={(e, newValue) => setEditableSettings(prev => ({...prev, voice_rate: newValue as number}))}
                                aria-labelledby="rate-slider"
                                valueLabelDisplay="auto"
                                step={0.01}
                                min={0.5}
                                max={2}
                            />
                             <Divider sx={{ my: 3 }}/>
                             <Typography variant="h6" gutterBottom>表示設定</Typography>
                              <TextField
                                label="キャラクター画像URL"
                                value={editableSettings.character_image_url || ''}
                                onChange={(e) => setEditableSettings(prev => ({ ...prev, character_image_url: e.target.value }))}
                                fullWidth
                                variant="outlined"
                                sx={{ mb: 2 }}
                            />
                             <TextField
                                label="背景画像URL"
                                value={editableSettings.background_image_url || ''}
                                onChange={(e) => setEditableSettings(prev => ({ ...prev, background_image_url: e.target.value }))}
                                fullWidth
                                variant="outlined"
                                sx={{ mb: 2 }}
                            />
                             <Divider sx={{ my: 3 }}/>
                             <Typography variant="h6" gutterBottom>表示フォントサイズ設定</Typography>
                             <Typography gutterBottom sx={{ mt: 2 }}>基本フォントサイズ (px)</Typography>
                             <Slider
                                value={editableSettings.font_size || 14}
                                onChange={(e, newValue) => setEditableSettings(prev => ({...prev, font_size: newValue as number}))}
                                aria-labelledby="font-size-slider"
                                valueLabelDisplay="auto"
                                step={1}
                                marks
                                min={12}
                                max={20}
                            />
                            <Divider sx={{ my: 3 }}/>
                            <Typography variant="h6" gutterBottom>吹き出し（テロップ）フォント設定</Typography>
                             <TextField
                                label="吹き出しフォントファミリー"
                                value={editableSettings.telop_font_family || ''}
                                onChange={(e) => setEditableSettings(prev => ({ ...prev, telop_font_family: e.target.value }))}
                                fullWidth
                                variant="outlined"
                                sx={{ mb: 2 }}
                                helperText="例: 'Noto Sans JP', sans-serif"
                            />
                            <Typography gutterBottom sx={{ mt: 2 }}>吹き出しフォントサイズ (px)</Typography>
                             <Slider
                                value={editableSettings.telop_font_size || 14}
                                onChange={(e, newValue) => setEditableSettings(prev => ({...prev, telop_font_size: newValue as number}))}
                                aria-labelledby="telop-font-size-slider"
                                valueLabelDisplay="auto"
                                step={1}
                                marks
                                min={12}
                                max={24}
                            />
                            <Divider sx={{ my: 3 }}/>
                            <Typography variant="h6" gutterBottom>検索設定</Typography>
                             <TextField
                                label="検索対象のベースURL"
                                value={editableSettings.search_base_url || ''}
                                onChange={(e) => setEditableSettings(prev => ({ ...prev, search_base_url: e.target.value }))}
                                fullWidth
                                variant="outlined"
                            />
                            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                                <Button variant="contained" onClick={handleSaveSettings} disabled={isPromptLoading}>
                                    設定を保存
                                </Button>
                            </Box>
                        </Box>
                    )}
                     {managementTab === 'knowledge' && (
                        <Box sx={{ p: 2, flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 2, minHeight: '60vh' }}>
                            <Typography variant="h6">ナレッジベース管理</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                AIの回答精度向上のため、特定の質問とそれに対応する参照URL、コンテンツ種類をナレッジとして登録・管理します。
                            </Typography>

                            <Paper component="form" onSubmit={(e) => { e.preventDefault(); editingKnowledgeEntry ? handleUpdateKnowledgeEntry() : handleAddKnowledgeEntry(); }} sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 2 }}>
                                <Typography variant="subtitle1" gutterBottom>
                                    {editingKnowledgeEntry ? 'ナレッジを編集' : '新しいナレッジを追加'}
                                </Typography>
                                <Stack spacing={2}>
                                    <TextField
                                        label="質問"
                                        fullWidth
                                        variant="outlined"
                                        size="small"
                                        value={editingKnowledgeEntry ? editingKnowledgeEntry.question : newKnowledgeEntry.question}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            if (editingKnowledgeEntry) {
                                                setEditingKnowledgeEntry(prev => prev ? { ...prev, question: value } : null);
                                            } else {
                                                setNewKnowledgeEntry(prev => ({ ...prev, question: value }));
                                            }
                                        }}
                                    />
                                    <TextField
                                        label="URL"
                                        fullWidth
                                        variant="outlined"
                                        size="small"
                                        value={editingKnowledgeEntry ? editingKnowledgeEntry.source_url : newKnowledgeEntry.source_url}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            if (editingKnowledgeEntry) {
                                                setEditingKnowledgeEntry(prev => prev ? { ...prev, source_url: value } : null);
                                            } else {
                                                setNewKnowledgeEntry(prev => ({ ...prev, source_url: value }));
                                            }
                                        }}
                                    />
                                    <TextField
                                        label="コンテンツ種類"
                                        fullWidth
                                        variant="outlined"
                                        size="small"
                                        value={editingKnowledgeEntry ? editingKnowledgeEntry.content_type : newKnowledgeEntry.content_type}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            if (editingKnowledgeEntry) {
                                                setEditingKnowledgeEntry(prev => prev ? { ...prev, content_type: value } : null);
                                            } else {
                                                setNewKnowledgeEntry(prev => ({ ...prev, content_type: value }));
                                            }
                                        }}
                                    />
                                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                                        {editingKnowledgeEntry && (
                                            <Button onClick={() => setEditingKnowledgeEntry(null)}>キャンセル</Button>
                                        )}
                                        <Button type="submit" variant="contained" disabled={isPromptLoading}>
                                            {editingKnowledgeEntry ? '更新' : '追加'}
                                        </Button>
                                    </Box>
                                </Stack>
                            </Paper>

                            <Divider sx={{ my: 1 }} />

                            <List sx={{ overflowY: 'auto', flexGrow: 1, maxHeight: '300px', border: 1, borderColor: 'divider', borderRadius: 2, p: 0 }}>
                                {isPromptLoading ? <Box sx={{display: 'flex', justifyContent: 'center', p: 2}}><CircularProgress /></Box> : knowledgeBaseEntries.map(entry => (
                                    <ListItem
                                        key={entry.id}
                                        secondaryAction={
                                            <Stack direction="row" spacing={1}>
                                                {/* @ts-ignore */}
                                                <Tooltip title="このナレッジを編集">
                                                    <IconButton edge="end" onClick={() => setEditingKnowledgeEntry(entry)}>
                                                        <Edit />
                                                    </IconButton>
                                                </Tooltip>
                                                {/* @ts-ignore */}
                                                <Tooltip title="このナレッジを削除">
                                                    <IconButton edge="end" onClick={() => handleDeleteKnowledgeEntry(entry.id)}>
                                                        <Delete />
                                                    </IconButton>
                                                </Tooltip>
                                            </Stack>
                                        }
                                        divider
                                    >
                                        <ListItemText
                                            primary={entry.question}
                                            secondary={`URL: ${entry.source_url} | 種類: ${entry.content_type}`}
                                            primaryTypographyProps={{ style: { whiteSpace: 'normal', wordBreak: 'break-word' } }}
                                            secondaryTypographyProps={{ style: { whiteSpace: 'normal', wordBreak: 'break-word' } }}
                                            sx={{ pr: '100px' }}
                                        />
                                    </ListItem>
                                ))}
                                {!isPromptLoading && knowledgeBaseEntries.length === 0 && (
                                    <ListItem>
                                        <ListItemText primary="登録済みのナレッジはありません。" sx={{textAlign: 'center', color: 'text.secondary'}}/>
                                    </ListItem>
                                )}
                            </List>
                        </Box>
                    )}
                    {managementTab === 'advanced_search' && (
                        <Box sx={{ p: 3, width: '100%' }}>
                            <Typography variant="h6" gutterBottom>Vertex AI Search (Edge Function)</Typography>
                            <FormControlLabel
                                control={<Switch checked={editableSettings.is_vertex_ai_search_enabled} onChange={(e) => setEditableSettings(prev => ({...prev, is_vertex_ai_search_enabled: e.target.checked}))} />}
                                label="Vertex AI Search を有効にする"
                            />
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                このオプションを有効にすると、AIへの質問はSupabase Edge Function経由で処理されます。<br/>
                                これにより、APIキーがサーバーサイドで安全に管理され、Google Searchを利用した高度な回答生成が行われます。<br/>
                                <strong>注:</strong> この機能は、実際のVertex AI Searchの動作を模倣したものです。
                            </Typography>
                            <Divider sx={{ my: 3 }} />
                            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                                <Button variant="contained" onClick={handleSaveSettings} disabled={isPromptLoading}>
                                    設定を保存
                                </Button>
                            </Box>
                        </Box>
                    )}
                    {managementTab === 'zendesk' && (
                        <Box sx={{ p: 3, width: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <Typography variant="h6" gutterBottom>Zendesk API 連携</Typography>
                             <FormControlLabel
                                control={<Switch checked={editableSettings.is_zendesk_enabled} onChange={(e) => setEditableSettings(prev => ({...prev, is_zendesk_enabled: e.target.checked}))} />}
                                label="Zendesk連携を有効にする"
                            />
                            <TextField
                                label="Zendesk サブドメイン"
                                value={editableSettings.zendesk_subdomain || ''}
                                onChange={(e) => setEditableSettings(prev => ({ ...prev, zendesk_subdomain: e.target.value }))}
                                fullWidth
                                variant="outlined"
                                placeholder="例: your-company"
                                helperText="https://your-company.zendesk.com の 'your-company' の部分"
                            />
                            <TextField
                                label="Zendesk ユーザーメールアドレス"
                                value={editableSettings.zendesk_user_email || ''}
                                onChange={(e) => setEditableSettings(prev => ({ ...prev, zendesk_user_email: e.target.value }))}
                                fullWidth
                                variant="outlined"
                                placeholder="例: agent@your-company.com"
                            />
                            <TextField
                                label="Zendesk APIトークン"
                                value={editableSettings.zendesk_api_token || ''}
                                onChange={(e) => setEditableSettings(prev => ({ ...prev, zendesk_api_token: e.target.value }))}
                                fullWidth
                                variant="outlined"
                                type="password"
                                helperText="Zendesk管理画面 > API > トークンアクセス で生成したトークン"
                            />
                            <Box sx={{ mt: 1, display: 'flex', justifyContent: 'flex-end' }}>
                                <Button variant="contained" onClick={handleSaveSettings} disabled={isPromptLoading}>
                                    接続情報を保存
                                </Button>
                            </Box>
                            <Divider sx={{ my: 2 }} />
                             <Typography variant="h6" gutterBottom>ナレッジ登録</Typography>
                             <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                「自動デモ管理」に登録されている全ての質問を、Zendeskにチケットとして一括で登録します。
                             </Typography>
                             <Button
                                variant="contained"
                                color="secondary"
                                startIcon={isPromptLoading ? <CircularProgress size={20} color="inherit" /> : <Sync />}
                                onClick={handleRegisterDemoQuestionsToZendesk}
                                disabled={
                                    isPromptLoading ||
                                    !editableSettings.is_zendesk_enabled ||
                                    !editableSettings.zendesk_subdomain ||
                                    !editableSettings.zendesk_user_email ||
                                    !editableSettings.zendesk_api_token ||
                                    demoQuestions.length === 0
                                }
                            >
                                デモ質問をZendeskに登録 ({demoQuestions.length}件)
                            </Button>

                        </Box>
                    )}
                    {managementTab === 'demo' && (
                        <Box sx={{ p: 2, flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                             <Typography variant="h6">自動デモの質問管理</Typography>
                             <Typography variant="body2" color="text.secondary" gutterBottom>ここで設定した質問が「自動デモ」スイッチをONにした際に順番に実行されます。</Typography>
                             
                             <TextField
                                label="質問生成プロンプト"
                                fullWidth
                                multiline
                                rows={8}
                                variant="outlined"
                                value={generationPrompt}
                                onChange={(e) => setGenerationPrompt(e.target.value)}
                                helperText="「{BASE_URL}」の部分は、AI設定で指定された検索対象URLに自動で置き換えられます。"
                                sx={{ mb: 1 }}
                              />

                             <Box>
                                <Button
                                  variant="contained"
                                  color="secondary"
                                  startIcon={isGeneratingQuestions ? <CircularProgress size={20} color="inherit" /> : <SmartToy />}
                                  onClick={handleGenerateDemoQuestions}
                                  disabled={isGeneratingQuestions || isPromptLoading}
                                >
                                    サイト情報から質問を自動生成
                                </Button>
                                <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                                  上記のプロンプトを使い、AI設定で指定したベースURLから質問を生成し、下のリストの末尾に追加します。
                                </Typography>
                             </Box>
                             <Divider />
                             <List sx={{ overflowY: 'auto', flexGrow: 1, minHeight: '300px' }}>
                                {(isPromptLoading && !isGeneratingQuestions) ? <CircularProgress sx={{m: 2}} /> : demoQuestions.map(q => (
                                    <ListItem
                                        key={q.id}
                                        secondaryAction={
                                            editingDemoQuestion?.id === q.id ? (
                                                <>
                                                    {/* @ts-ignore */}
                                                    <Tooltip title="保存">
                                                        <IconButton edge="end" onClick={handleUpdateDemoQuestion}>
                                                            <CheckCircle color="success" />
                                                        </IconButton>
                                                    </Tooltip>
                                                    {/* @ts-ignore */}
                                                    <Tooltip title="キャンセル">
                                                        <IconButton edge="end" onClick={() => setEditingDemoQuestion(null)}>
                                                            <Close />
                                                        </IconButton>
                                                    </Tooltip>
                                                </>
                                            ) : (
                                                <>
                                                    {/* @ts-ignore */}
                                                    <Tooltip title="この質問を編集">
                                                        <IconButton edge="end" onClick={() => setEditingDemoQuestion(q)}>
                                                            <Edit />
                                                        </IconButton>
                                                    </Tooltip>
                                                    {/* @ts-ignore */}
                                                    <Tooltip title="この質問を削除">
                                                        <IconButton edge="end" onClick={() => handleDeleteDemoQuestion(q.id)}>
                                                            <Delete />
                                                        </IconButton>
                                                    </Tooltip>
                                                </>
                                            )
                                        }
                                    >
                                        {editingDemoQuestion?.id === q.id ? (
                                            <TextField
                                                value={editingDemoQuestion.question_text}
                                                onChange={(e) => setEditingDemoQuestion(prev => prev ? { ...prev, question_text: e.target.value } : null)}
                                                variant="standard"
                                                fullWidth
                                                autoFocus
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        handleUpdateDemoQuestion();
                                                    }
                                                    if (e.key === 'Escape') {
                                                        e.preventDefault();
                                                        setEditingDemoQuestion(null);
                                                    }
                                                }}
                                            />
                                        ) : (
                                            <ListItemText primary={q.question_text} />
                                        )}
                                    </ListItem>
                                ))}
                             </List>
                             <Divider />
                             <Box component="form" sx={{ display: 'flex', gap: 1, alignItems: 'center', p: 1 }} onSubmit={(e) => { e.preventDefault(); handleAddDemoQuestion(); }}>
                                <TextField
                                    label="新しいデモ質問を追加"
                                    value={newDemoQuestionText}
                                    onChange={(e) => setNewDemoQuestionText(e.target.value)}
                                    fullWidth
                                    variant="outlined"
                                    size="small"
                                />
                                <Button
                                    type="submit"
                                    variant="contained"
                                    disabled={isPromptLoading || !newDemoQuestionText.trim()}
                                    startIcon={<Add />}
                                >
                                    追加
                                </Button>
                             </Box>
                        </Box>
                    )}
                </Box>
            </DialogContent>
        </Dialog>

        {/* --- Global Snackbar --- */}
        <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={handleCloseSnackbar} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
            <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
                {snackbar.message}
            </Alert>
        </Snackbar>
      </>
      )}
    </ThemeProvider>
  );
}