export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type AnalysisStatus =
  | "pending"
  | "fetching"
  | "selecting"
  | "parsing"
  | "completed"
  | "failed"
  | "stale";

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          name: string;
          slug?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          repository_url: string;
          default_branch: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          repository_url: string;
          default_branch?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          name?: string;
          repository_url?: string;
          default_branch?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "projects_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      analyses: {
        Row: {
          id: string;
          organization_id: string;
          project_id: string;
          commit_hash: string | null;
          status: AnalysisStatus;
          stage: string | null;
          error_message: string | null;
          file_count: number;
          edge_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          project_id: string;
          commit_hash?: string | null;
          status: AnalysisStatus;
          stage?: string | null;
          error_message?: string | null;
          file_count?: number;
          edge_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          project_id?: string;
          commit_hash?: string | null;
          status?: AnalysisStatus;
          stage?: string | null;
          error_message?: string | null;
          file_count?: number;
          edge_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "analyses_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "analyses_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      files: {
        Row: {
          id: string;
          organization_id: string;
          analysis_id: string;
          path: string;
          folder: string;
          line_count: number;
          hash: string | null;
          fan_in: number;
          fan_out: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          analysis_id: string;
          path: string;
          folder: string;
          line_count?: number;
          hash?: string | null;
          fan_in?: number;
          fan_out?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          analysis_id?: string;
          path?: string;
          folder?: string;
          line_count?: number;
          hash?: string | null;
          fan_in?: number;
          fan_out?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "files_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "files_analysis_id_fkey";
            columns: ["analysis_id"];
            isOneToOne: false;
            referencedRelation: "analyses";
            referencedColumns: ["id"];
          },
        ];
      };
      edges: {
        Row: {
          id: string;
          organization_id: string;
          analysis_id: string;
          source_file_id: string;
          target_file_id: string | null;
          target_path: string;
          kind: string;
          is_resolved: boolean;
          unresolved_reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          analysis_id: string;
          source_file_id: string;
          target_file_id?: string | null;
          target_path: string;
          kind: string;
          is_resolved?: boolean;
          unresolved_reason?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          analysis_id?: string;
          source_file_id?: string;
          target_file_id?: string | null;
          target_path?: string;
          kind?: string;
          is_resolved?: boolean;
          unresolved_reason?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "edges_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "edges_analysis_id_fkey";
            columns: ["analysis_id"];
            isOneToOne: false;
            referencedRelation: "analyses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "edges_source_file_id_fkey";
            columns: ["source_file_id"];
            isOneToOne: false;
            referencedRelation: "files";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "edges_target_file_id_fkey";
            columns: ["target_file_id"];
            isOneToOne: false;
            referencedRelation: "files";
            referencedColumns: ["id"];
          },
        ];
      };
      routes: {
        Row: {
          id: string;
          organization_id: string;
          analysis_id: string;
          file_id: string;
          method: string;
          pattern: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          analysis_id: string;
          file_id: string;
          method: string;
          pattern: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          analysis_id?: string;
          file_id?: string;
          method?: string;
          pattern?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "routes_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "routes_analysis_id_fkey";
            columns: ["analysis_id"];
            isOneToOne: false;
            referencedRelation: "analyses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "routes_file_id_fkey";
            columns: ["file_id"];
            isOneToOne: false;
            referencedRelation: "files";
            referencedColumns: ["id"];
          },
        ];
      };
      explanations: {
        Row: {
          id: string;
          organization_id: string;
          analysis_id: string;
          file_id: string;
          content: string;
          model: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          analysis_id: string;
          file_id: string;
          content: string;
          model?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          analysis_id?: string;
          file_id?: string;
          content?: string;
          model?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "explanations_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "explanations_analysis_id_fkey";
            columns: ["analysis_id"];
            isOneToOne: false;
            referencedRelation: "analyses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "explanations_file_id_fkey";
            columns: ["file_id"];
            isOneToOne: false;
            referencedRelation: "files";
            referencedColumns: ["id"];
          },
        ];
      };
      file_roles: {
        Row: {
          id: string;
          organization_id: string;
          analysis_id: string;
          file_id: string;
          role: string;
          confidence: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          analysis_id: string;
          file_id: string;
          role: string;
          confidence?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          analysis_id?: string;
          file_id?: string;
          role?: string;
          confidence?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "file_roles_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "file_roles_analysis_id_fkey";
            columns: ["analysis_id"];
            isOneToOne: false;
            referencedRelation: "analyses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "file_roles_file_id_fkey";
            columns: ["file_id"];
            isOneToOne: false;
            referencedRelation: "files";
            referencedColumns: ["id"];
          },
        ];
      };
      insights: {
        Row: {
          id: string;
          organization_id: string;
          analysis_id: string;
          kind: string;
          data: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          analysis_id: string;
          kind: string;
          data?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          analysis_id?: string;
          kind?: string;
          data?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "insights_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "insights_analysis_id_fkey";
            columns: ["analysis_id"];
            isOneToOne: false;
            referencedRelation: "analyses";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      requesting_org_id: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

