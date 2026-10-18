/** Minimal Database typing for Supabase client — extend as schema grows */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      categories: {
        Row: {
          id: string;
          slug: string;
          name: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          sort_order?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["categories"]["Insert"]>;
      };
      sources: {
        Row: {
          id: string;
          name: string;
          domain: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          domain?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["sources"]["Insert"]>;
      };
      articles: {
        Row: {
          id: string;
          external_id: string;
          title: string;
          simple_title: string | null;
          url: string;
          description: string | null;
          summary: string | null;
          why_it_matters: string | null;
          key_terms: { term: string; explanation: string }[] | null;
          image_url: string | null;
          category_id: string | null;
          source_id: string | null;
          published_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          external_id: string;
          title: string;
          simple_title?: string | null;
          url: string;
          description?: string | null;
          summary?: string | null;
          why_it_matters?: string | null;
          key_terms?: { term: string; explanation: string }[] | null;
          image_url?: string | null;
          category_id?: string | null;
          source_id?: string | null;
          published_at: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["articles"]["Insert"]>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
