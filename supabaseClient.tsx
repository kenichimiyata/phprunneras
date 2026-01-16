/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient } from '@supabase/supabase-js';

// ---------------- Types ----------------
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      chat_history: {
        Row: {
          id: number
          created_at: string
          content: string
          role: string
          user_id: string | null
        }
        Insert: {
          id?: number
          created_at?: string
          content: string
          role: string
          user_id?: string
        }
        Update: {
          id?: number
          created_at?: string
          content?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      chat_returns: {
        Row: {
          id: number
          answer: string
          created_at: string
          user_id: string | null
        }
        Insert: {
          id?: number
          answer: string
          created_at?: string
          user_id?: string
        }
        Update: {
          id?: number
          answer?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_returns_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      prompts: {
        Row: {
          id: number
          user_id: string
          title: string
          content: string
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: number
          user_id: string
          title: string
          content: string
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: number
          user_id?: string
          title?: string
          content?: string
          created_at?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prompts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      user_settings: {
        Row: {
            user_id: string
            voice_pitch: number
            voice_rate: number
            search_base_url: string
            character_image_url: string
            background_image_url: string
            is_speech_enabled: boolean
            is_vertex_ai_search_enabled: boolean
            updated_at: string
            is_zendesk_enabled: boolean
            zendesk_subdomain: string | null
            zendesk_user_email: string | null
            zendesk_api_token: string | null
            font_size: number
            telop_font_family: string | null
            telop_font_size: number
            voice_lang: string | null
            voice_name: string | null
        }
        Insert: {
            user_id: string
            voice_pitch?: number
            voice_rate?: number
            search_base_url?: string
            character_image_url?: string
            background_image_url?: string
            is_speech_enabled?: boolean
            is_vertex_ai_search_enabled?: boolean
            updated_at?: string
            is_zendesk_enabled?: boolean
            zendesk_subdomain?: string | null
            zendesk_user_email?: string | null
            zendesk_api_token?: string | null
            font_size?: number
            telop_font_family?: string | null
            telop_font_size?: number
            voice_lang?: string | null
            voice_name?: string | null
        }
        Update: {
            user_id?: string
            voice_pitch?: number
            voice_rate?: number
            search_base_url?: string
            character_image_url?: string
            background_image_url?: string
            is_speech_enabled?: boolean
            is_vertex_ai_search_enabled?: boolean
            updated_at?: string
            is_zendesk_enabled?: boolean
            zendesk_subdomain?: string | null
            zendesk_user_email?: string | null
            zendesk_api_token?: string | null
            font_size?: number
            telop_font_family?: string | null
            telop_font_size?: number
            voice_lang?: string | null
            voice_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      demo_questions: {
        Row: {
          id: number
          user_id: string
          question_text: string
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: number
          user_id: string
          question_text: string
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: number
          user_id?: string
          question_text?: string
          sort_order?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "demo_questions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      webrtc_signals: {
        Row: {
          id: number
          created_at: string
          room: string
          signal: Json
        }
        Insert: {
          id?: number
          created_at?: string
          room: string
          signal: Json
        }
        Update: {
          id?: number
          created_at?: string
          room?: string
          signal?: Json
        }
        Relationships: []
      }
      knowledge_base: {
        Row: {
          id: number
          user_id: string
          question: string
          source_url: string
          content_type: string
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: number
          user_id: string
          question: string
          source_url: string
          content_type: string
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: number
          user_id?: string
          question?: string
          source_url?: string
          content_type?: string
          created_at?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_base_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
};

export type Prompt = Database['public']['Tables']['prompts']['Row'];
export type UserSettings = Database['public']['Tables']['user_settings']['Row'];
export type DemoQuestion = Database['public']['Tables']['demo_questions']['Row'];
export type KnowledgeBaseEntry = Database['public']['Tables']['knowledge_base']['Row'];


// Fix: Hardcode Supabase credentials to resolve persistent environment variable loading issues.
const SUPABASE_URL = 'https://rootomzbucovwdqsscqd.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJvb3RvbXpidWNvdndkcXNzY3FkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU4OTE4ODMsImV4cCI6MjA1MTQ2Nzg4M30.fYKOe-HPh4WUdvBhEJxakLWCMQBp4E90EDwARk7ucf8';

const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_KEY);

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

// ---------------- Settings Functions ----------------

export async function getUserSettings(userId: string): Promise<UserSettings> {
  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116: 'Exact one row was not found'
    console.error('❌ [Supabase] Error fetching user settings:', error.message);
    return { ...DEFAULT_SETTINGS, user_id: userId };
  }
  
  if (data) {
    return { ...DEFAULT_SETTINGS, ...data }; // Merge with defaults to ensure new fields exist
  } else {
    // No settings found, create them for the user
    console.log(`- [Supabase] No settings found for user ${userId}. Creating defaults.`);
    const { data: newSettings, error: insertError } = await supabase
      .from('user_settings')
      .insert({ 
          user_id: userId, 
          ...DEFAULT_SETTINGS, // Spread defaults here
      })
      .select()
      .single();

    if (insertError) {
        // Fix: Gracefully handle race condition where settings are created concurrently.
        // '23505' is the PostgreSQL code for unique_violation.
        if (insertError.code === '23505') {
            console.log(`- [Supabase] Settings created concurrently for user ${userId}. Re-fetching.`);
            const { data: refetchedData, error: refetchError } = await supabase
                .from('user_settings')
                .select('*')
                .eq('user_id', userId)
                .single();
            if (refetchError) {
                console.error('❌ [Supabase] Error re-fetching user settings after race condition:', refetchError.message);
                return { ...DEFAULT_SETTINGS, user_id: userId };
            }
            return refetchedData || { ...DEFAULT_SETTINGS, user_id: userId };
        }
        console.error('❌ [Supabase] Error creating default user settings:', insertError.message);
        return { ...DEFAULT_SETTINGS, user_id: userId };
    }
    return newSettings || { ...DEFAULT_SETTINGS, user_id: userId };
  }
}

// Fix: Corrected the type for the `settings` parameter.
// The original type `Partial<UserSettings>` was too permissive, making the required `user_id` property optional.
// Using the generated `Insert` type from the database schema ensures type safety for the `upsert` call.
export async function upsertUserSettings(settings: Database['public']['Tables']['user_settings']['Insert']): Promise<{ data: UserSettings | null, error: any }> {
    const { data, error } = await supabase
        .from('user_settings')
        .upsert({ ...settings, updated_at: new Date().toISOString() })
        .select()
        .single();

    if (error) {
        console.error('❌ [Supabase] Error upserting user settings:', error.message);
    }
    return { data, error };
}

// ---------------- Prompt Functions ----------------

export async function getPrompts(userId: string): Promise<Prompt[]> {
  const { data, error } = await supabase
    .from('prompts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ [Supabase] Error fetching prompts:', error.message);
    return [];
  }
  return data || [];
}

export async function getPromptContent(promptId: number): Promise<string | null> {
    const { data, error } = await supabase
        .from('prompts')
        .select('content')
        .eq('id', promptId)
        .maybeSingle(); // Fix: Use maybeSingle() to prevent errors when no row is found.
    if (error) {
        console.error(`❌ [Supabase] Error fetching prompt content for id ${promptId}:`, error.message);
        return null;
    }
    return data?.content ?? null;
}

// Fix: Corrected the type for the `prompt` parameter.
// The original type `Partial<Prompt>` was too permissive, making required fields like `title` and `content` optional.
// Using the generated `Insert` type from the database schema ensures type safety and matches the `upsert` method's expectations.
export async function upsertPrompt(prompt: Database['public']['Tables']['prompts']['Insert']): Promise<Prompt | null> {
  const { data, error } = await supabase
    .from('prompts')
    .upsert(prompt)
    .select()
    .single();

  if (error) {
    console.error('❌ [Supabase] Error upserting prompt:', error.message);
    return null;
  }
  console.log(`✅ [Supabase] Prompt ${prompt.id ? 'updated' : 'created'} successfully.`);
  return data;
}

export async function deletePrompt(promptId: number): Promise<{ error: any }> {
  const { error } = await supabase.from('prompts').delete().eq('id', promptId);
  if (error) {
    console.error(`❌ [Supabase] Error deleting prompt ${promptId}:`, error.message);
  } else {
    console.log(`✅ [Supabase] Prompt ${promptId} deleted successfully.`);
  }
  return { error };
}

// ---------------- Demo Question Functions ----------------

export async function getDemoQuestions(userId: string): Promise<DemoQuestion[]> {
  const { data, error } = await supabase
    .from('demo_questions')
    .select('*')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('❌ [Supabase] Error fetching demo questions:', error.message);
    return [];
  }
  return data || [];
}

export async function upsertDemoQuestion(question: DemoQuestion | Omit<DemoQuestion, 'id' | 'created_at'>): Promise<DemoQuestion | null> {
  const { data, error } = await supabase
    .from('demo_questions')
    .upsert(question)
    .select()
    .single();
  
  if (error) {
    console.error('❌ [Supabase] Error upserting demo question:', error.message);
    return null;
  }
  return data;
}

export async function deleteDemoQuestion(questionId: number): Promise<{ error: any }> {
  const { error } = await supabase.from('demo_questions').delete().eq('id', questionId);
  if (error) {
    console.error(`❌ [Supabase] Error deleting demo question ${questionId}:`, error.message);
  }
  return { error };
}

// ---------------- Knowledge Base Functions ----------------

export async function getKnowledgeBaseEntries(userId: string): Promise<KnowledgeBaseEntry[]> {
  const { data, error } = await supabase
    .from('knowledge_base')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ [Supabase] Error fetching knowledge base entries:', error.message);
    return [];
  }
  return data || [];
}

export async function upsertKnowledgeBaseEntry(entry: Database['public']['Tables']['knowledge_base']['Insert']): Promise<KnowledgeBaseEntry | null> {
  const { data, error } = await supabase
    .from('knowledge_base')
    .upsert(entry)
    .select()
    .single();

  if (error) {
    console.error('❌ [Supabase] Error upserting knowledge base entry:', error.message);
    return null;
  }
  return data;
}

export async function deleteKnowledgeBaseEntry(entryId: number): Promise<{ error: any }> {
  const { error } = await supabase.from('knowledge_base').delete().eq('id', entryId);
  if (error) {
    console.error(`❌ [Supabase] Error deleting knowledge base entry ${entryId}:`, error.message);
  }
  return { error };
}


// ---------------- User Metadata for Active Prompt ----------------

export async function getUserActivePromptId(): Promise<number | null> {
    // Fix: Use `supabase.auth.getUser()` (v2, async). Cast to any to bypass environment-specific TS error.
    const { data: { user } } = await (supabase.auth as any).getUser();
    if (!user) {
        console.error('❌ [Supabase] Error fetching user for active prompt ID: user is null.');
        return null;
    }
    return user.user_metadata?.active_prompt_id ?? null;
}

export async function updateUserActivePrompt(promptId: number | null): Promise<{ error: any }> {
    // Fix: Use `updateUser` (v2). Cast to any to bypass environment-specific TS error.
    const { error } = await (supabase.auth as any).updateUser({
        data: { active_prompt_id: promptId }
    });
    if (error) {
        console.error('❌ [Supabase] Error updating active prompt:', error.message);
    } else {
        console.log(`✅ [Supabase] User active prompt set to ${promptId}.`);
    }
    return { error };
}

// ---------------- Edge Function Invokers ----------------

export async function invokeYoutubeTranscript(videoId: string): Promise<{ transcript: string | null; error: string | null }> {
    try {
        const { data, error } = await supabase.functions.invoke('get-youtube-transcript', {
            body: { videoId },
        });

        if (error) {
            console.error('❌ [Supabase Function] Invocation error (get-youtube-transcript):', error);
            const detailedError = `Edge Function 'get-youtube-transcript' の呼び出しに失敗しました。\n\n**解決策:** Readme.mdのセットアップ手順に従って、Edge Functionが正しくデプロイされているか、特に \`--no-verify-jwt\` フラグがコマンドに含まれているかを確認してください。`;
            return { transcript: null, error: detailedError };
        }

        if (data.error) {
            console.error('❌ [Supabase Function] Transcript error:', data.error);
            return { transcript: null, error: data.error };
        }

        return { transcript: data.transcript, error: null };
    } catch (e: any) {
        console.error('❌ [Supabase Function] Exception during invocation of get-youtube-transcript:', e);
        const detailedError = `Edge Functionへのリクエスト送信に失敗しました (get-youtube-transcript)。\nReadme.mdのトラブルシューティングガイドを参照してください。`;
        return { transcript: null, error: detailedError };
    }
}


// ---------------- Other Functions ----------------

const BUCKET_NAME = 'chat_uploads';

/**
 * Uploads a file to Supabase Storage and returns its public URL.
 * @param file The file to upload.
 * @param userId The ID of the authenticated user.
 * @returns The public URL of the uploaded file.
 * @throws Will throw an error if the upload fails.
 */
export async function uploadFileAndGetUrl(file: File, userId: string): Promise<string> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}.${fileExt}`;
  const filePath = `${userId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, file);

  if (uploadError) {
    console.error('❌ [Supabase Storage] Upload error:', uploadError.message);
    // Re-throw the error to be handled by the calling function
    throw uploadError;
  }

  const { data } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(filePath);
  
  if (!data.publicUrl) {
    throw new Error('Failed to get public URL after upload.');
  }

  console.log('✅ [Supabase Storage] File uploaded:', data.publicUrl);
  return data.publicUrl;
}

/**
 * Saves a generated answer to the 'chat_returns' table.
 * @param answer The answer text from the AI model.
 * @param userId The ID of the authenticated user.
 */
export async function saveAnswerToSupabase(answer: string, userId:string) {
  try {
    const clean = (answer || '').trim();
    if (!clean) return;
    const { error } = await supabase
      .from('chat_returns')
      .insert([{ answer: clean, user_id: userId }]);
    if (error) {
      console.error('❌ [Supabase] insert error:', error.message, 'Details:', JSON.stringify(error, null, 2));
    } else {
      console.log('✅ [Supabase] answer saved');
    }
  } catch (e) {
    console.error('❌ [Supabase] insert exception:', e);
  }
}

/**
 * Inserts a message into the 'chat_history' table for real-time updates.
 * @param message The message to insert.
 * @param userId The ID of the authenticated user.
 * @returns A promise that resolves with the result of the insert operation.
 */
export async function insertChatMessage(message: string, userId: string) {
  return supabase
    .from('chat_history')
    .insert([{ content: message, user_id: userId, role: 'user' }])
    .select();
}

/**
 * Sends a WebRTC signaling message to a specific room.
 * @param roomId The ID of the room.
 * @param signalPayload The signal payload to send, including the sender's peer ID.
 */
export async function sendWebRTCSignal(roomId: string, signalPayload: any) {
  const { error } = await supabase.from('webrtc_signals').insert({ room: roomId, signal: signalPayload });
  if (error) {
    console.error('❌ [Supabase] WebRTC signal insert error:', error.message, 'Details:', JSON.stringify(error, null, 2));
  }
}


export default supabase;