export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      attendance_records: {
        Row: {
          check_out_at: string | null
          class_id: string
          date: string
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
          submitted_at: string
          submitted_by: string | null
          validated_by: string | null
          validation_status: Database["public"]["Enums"]["validation_status"]
        }
        Insert: {
          check_out_at?: string | null
          class_id: string
          date: string
          id?: string
          notes?: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
          submitted_at?: string
          submitted_by?: string | null
          validated_by?: string | null
          validation_status?: Database["public"]["Enums"]["validation_status"]
        }
        Update: {
          check_out_at?: string | null
          class_id?: string
          date?: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id?: string
          submitted_at?: string
          submitted_by?: string | null
          validated_by?: string | null
          validation_status?: Database["public"]["Enums"]["validation_status"]
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_settings: {
        Row: {
          check_in_end: string
          check_in_start: string
          check_out_end: string
          check_out_start: string
          day_of_week: string
          enabled: boolean
          id: string
        }
        Insert: {
          check_in_end?: string
          check_in_start?: string
          check_out_end?: string
          check_out_start?: string
          day_of_week: string
          enabled?: boolean
          id?: string
        }
        Update: {
          check_in_end?: string
          check_in_start?: string
          check_out_end?: string
          check_out_start?: string
          day_of_week?: string
          enabled?: boolean
          id?: string
        }
        Relationships: []
      }
      classes: {
        Row: {
          created_at: string
          id: string
          name: string
          wa_group_id: string | null
          wali_kelas: string | null
          wali_kelas_nip: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          wa_group_id?: string | null
          wali_kelas?: string | null
          wali_kelas_nip?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          wa_group_id?: string | null
          wali_kelas?: string | null
          wali_kelas_nip?: string | null
        }
        Relationships: []
      }
      guru_piket_assignments: {
        Row: {
          created_at: string
          day_of_week: string
          id: string
          user_id: string
          user_name: string
        }
        Insert: {
          created_at?: string
          day_of_week: string
          id?: string
          user_id: string
          user_name: string
        }
        Update: {
          created_at?: string
          day_of_week?: string
          id?: string
          user_id?: string
          user_name?: string
        }
        Relationships: []
      }
      holidays: {
        Row: {
          created_at: string
          description: string
          end_date: string
          id: string
          start_date: string
        }
        Insert: {
          created_at?: string
          description: string
          end_date: string
          id?: string
          start_date: string
        }
        Update: {
          created_at?: string
          description?: string
          end_date?: string
          id?: string
          start_date?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          name: string
          password: string | null
          password_hash: string | null
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          password?: string | null
          password_hash?: string | null
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          password?: string | null
          password_hash?: string | null
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      students: {
        Row: {
          class_id: string
          created_at: string
          gender: string | null
          id: string
          name: string
          nis: string | null
          photo_url: string | null
        }
        Insert: {
          class_id: string
          created_at?: string
          gender?: string | null
          id?: string
          name: string
          nis?: string | null
          photo_url?: string | null
        }
        Update: {
          class_id?: string
          created_at?: string
          gender?: string | null
          id?: string
          name?: string
          nis?: string | null
          photo_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      web_config: {
        Row: {
          app_subtitle: string
          app_title: string
          bg_images: string | null
          bg_url_1: string | null
          bg_url_2: string | null
          bg_url_3: string | null
          bg_url_4: string | null
          gdrive_auto_backed_up_date: string | null
          gdrive_auto_backup_enabled: boolean
          gdrive_auto_backup_schedule: string
          gdrive_auto_backup_time: string
          google_connected_email: string | null
          google_drive_folder_id: string | null
          google_refresh_token: string | null
          id: string
          logo_url: string | null
          school_city: string | null
          school_start_date: string | null
          updated_at: string
          wa_auto_send_enabled: boolean
          wa_auto_send_scope: string | null
          wa_auto_send_time: string
          wa_auto_sent_date: string | null
          wa_provider: string | null
          wa_target_number: string | null
          wa_token: string | null
        }
        Insert: {
          app_subtitle?: string
          app_title?: string
          bg_images?: string | null
          bg_url_1?: string | null
          bg_url_2?: string | null
          bg_url_3?: string | null
          bg_url_4?: string | null
          gdrive_auto_backed_up_date?: string | null
          gdrive_auto_backup_enabled?: boolean
          gdrive_auto_backup_schedule?: string
          gdrive_auto_backup_time?: string
          google_connected_email?: string | null
          google_drive_folder_id?: string | null
          google_refresh_token?: string | null
          id?: string
          logo_url?: string | null
          school_city?: string | null
          school_start_date?: string | null
          updated_at?: string
          wa_auto_send_enabled?: boolean
          wa_auto_send_scope?: string | null
          wa_auto_send_time?: string
          wa_auto_sent_date?: string | null
          wa_provider?: string | null
          wa_target_number?: string | null
          wa_token?: string | null
        }
        Update: {
          app_subtitle?: string
          app_title?: string
          bg_images?: string | null
          bg_url_1?: string | null
          bg_url_2?: string | null
          bg_url_3?: string | null
          bg_url_4?: string | null
          gdrive_auto_backed_up_date?: string | null
          gdrive_auto_backup_enabled?: boolean
          gdrive_auto_backup_schedule?: string
          gdrive_auto_backup_time?: string
          google_connected_email?: string | null
          google_drive_folder_id?: string | null
          google_refresh_token?: string | null
          id?: string
          logo_url?: string | null
          school_city?: string | null
          school_start_date?: string | null
          updated_at?: string
          wa_auto_send_enabled?: boolean
          wa_auto_send_scope?: string | null
          wa_auto_send_time?: string
          wa_auto_sent_date?: string | null
          wa_provider?: string | null
          wa_target_number?: string | null
          wa_token?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "guru"
      attendance_status: "hadir" | "izin" | "sakit" | "alpa"
      validation_status: "pending" | "approved" | "rejected"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] &
      DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "guru"],
      attendance_status: ["hadir", "izin", "sakit", "alpa"],
      validation_status: ["pending", "approved", "rejected"],
    },
  },
} as const
