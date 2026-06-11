export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      estacas: {
        Row: {
          cc: number | null
          coord_e: number | null
          coord_n: number | null
          cr: number | null
          created_at: string
          ct: number | null
          declividade: number | null
          diametro: number | null
          g: number | null
          h: number | null
          id: string
          nome: string
          os_id: string
          p: number | null
          pv_nome: string | null
          pv_prof: number | null
          pv_tipo: Database["public"]["Enums"]["pv_tipo"] | null
          r: number | null
          updated_at: string
        }
        Insert: {
          cc?: number | null
          coord_e?: number | null
          coord_n?: number | null
          cr?: number | null
          created_at?: string
          ct?: number | null
          declividade?: number | null
          diametro?: number | null
          g?: number | null
          h?: number | null
          id?: string
          nome: string
          os_id: string
          p?: number | null
          pv_nome?: string | null
          pv_prof?: number | null
          pv_tipo?: Database["public"]["Enums"]["pv_tipo"] | null
          r?: number | null
          updated_at?: string
        }
        Update: {
          cc?: number | null
          coord_e?: number | null
          coord_n?: number | null
          cr?: number | null
          created_at?: string
          ct?: number | null
          declividade?: number | null
          diametro?: number | null
          g?: number | null
          h?: number | null
          id?: string
          nome?: string
          os_id?: string
          p?: number | null
          pv_nome?: string | null
          pv_prof?: number | null
          pv_tipo?: Database["public"]["Enums"]["pv_tipo"] | null
          r?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "estacas_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      import_logs: {
        Row: {
          changes: Json
          created_at: string
          created_count: number
          error_count: number
          errors: Json
          filename: string | null
          id: string
          total_rows: number
          unchanged_count: number
          updated_count: number
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          changes?: Json
          created_at?: string
          created_count?: number
          error_count?: number
          errors?: Json
          filename?: string | null
          id?: string
          total_rows?: number
          unchanged_count?: number
          updated_count?: number
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          changes?: Json
          created_at?: string
          created_count?: number
          error_count?: number
          errors?: Json
          filename?: string | null
          id?: string
          total_rows?: number
          unchanged_count?: number
          updated_count?: number
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      kmz_layer_groups: {
        Row: {
          created_at: string
          criado_por: string | null
          id: string
          name: string
          ordem: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          criado_por?: string | null
          id?: string
          name: string
          ordem?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          criado_por?: string | null
          id?: string
          name?: string
          ordem?: number
          updated_at?: string
        }
        Relationships: []
      }
      ligacoes: {
        Row: {
          comprimento: number | null
          created_at: string
          data_topografia: string | null
          encarregado_id: string
          id: string
          latitude: number | null
          longitude: number | null
          os_id: string
          referencia: string | null
          registro_producao_id: string | null
          topografo_id: string | null
          updated_at: string
        }
        Insert: {
          comprimento?: number | null
          created_at?: string
          data_topografia?: string | null
          encarregado_id: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          os_id: string
          referencia?: string | null
          registro_producao_id?: string | null
          topografo_id?: string | null
          updated_at?: string
        }
        Update: {
          comprimento?: number | null
          created_at?: string
          data_topografia?: string | null
          encarregado_id?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          os_id?: string
          referencia?: string | null
          registro_producao_id?: string | null
          topografo_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ligacoes_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ligacoes_registro_producao_id_fkey"
            columns: ["registro_producao_id"]
            isOneToOne: false
            referencedRelation: "registros_producao"
            referencedColumns: ["id"]
          },
        ]
      }
      mapa_asbuilt_config: {
        Row: {
          cor: string
          id: string
          layer_key: string
          opacidade: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cor: string
          id?: string
          layer_key: string
          opacidade?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cor?: string
          id?: string
          layer_key?: string
          opacidade?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      mapa_camadas: {
        Row: {
          arquivo_nome: string
          cor: string
          created_at: string
          criado_por: string | null
          descricao: string | null
          group_id: string | null
          id: string
          nome: string
          opacidade: number
          ordem: number
          storage_path: string
          updated_at: string
          visivel_default: boolean
        }
        Insert: {
          arquivo_nome: string
          cor?: string
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          group_id?: string | null
          id?: string
          nome: string
          opacidade?: number
          ordem?: number
          storage_path: string
          updated_at?: string
          visivel_default?: boolean
        }
        Update: {
          arquivo_nome?: string
          cor?: string
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          group_id?: string | null
          id?: string
          nome?: string
          opacidade?: number
          ordem?: number
          storage_path?: string
          updated_at?: string
          visivel_default?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "mapa_camadas_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "kmz_layer_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      materiais_entrega: {
        Row: {
          created_at: string
          data_entrega: string
          descricao: string
          divergencia: boolean | null
          id: string
          obs_divergencia: string | null
          os_id: string
          quantidade: number
          registrado_por: string | null
          unidade: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_entrega?: string
          descricao: string
          divergencia?: boolean | null
          id?: string
          obs_divergencia?: string | null
          os_id: string
          quantidade?: number
          registrado_por?: string | null
          unidade?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_entrega?: string
          descricao?: string
          divergencia?: boolean | null
          id?: string
          obs_divergencia?: string | null
          os_id?: string
          quantidade?: number
          registrado_por?: string | null
          unidade?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "materiais_entrega_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      ordens_servico: {
        Row: {
          areia: string | null
          areia_real: string | null
          as_built_lat: number | null
          as_built_lng: number | null
          bacia: string
          bms: string | null
          bms_real: string | null
          bomba_rebaixo: boolean | null
          brita: string | null
          brita_real: string | null
          comprimento_previsto: number | null
          comprimento_real: number | null
          created_at: string
          dn: number | null
          dn_real: number | null
          executor: string | null
          executor_real: string | null
          id: string
          largura_pav_prevista: number | null
          largura_pav_real: number | null
          largura_vala: number | null
          largura_vala_real: number | null
          liberado: boolean
          liberado_para: string | null
          ligacoes_previstas: number | null
          ligacoes_real: number | null
          material_entregue_em: string | null
          material_entregue_por: string | null
          pav_extensoes_previsto: Json | null
          pav_extensoes_real: Json | null
          pav_m2_previsto: number | null
          pav_m2_real: number | null
          pav_previsto: string | null
          pav_real: string | null
          prazo_arredondado: number | null
          prazo_previsto: number | null
          prazo_real: number | null
          prof_jusante: number | null
          prof_jusante_real: number | null
          prof_media_executada: number | null
          prof_media_prevista: number | null
          prof_media_real: number | null
          prof_montante: number | null
          prof_montante_real: number | null
          pv_jusante: string | null
          pv_montante: string | null
          status: Database["public"]["Enums"]["os_status"]
          trecho: string
          updated_at: string
        }
        Insert: {
          areia?: string | null
          areia_real?: string | null
          as_built_lat?: number | null
          as_built_lng?: number | null
          bacia?: string
          bms?: string | null
          bms_real?: string | null
          bomba_rebaixo?: boolean | null
          brita?: string | null
          brita_real?: string | null
          comprimento_previsto?: number | null
          comprimento_real?: number | null
          created_at?: string
          dn?: number | null
          dn_real?: number | null
          executor?: string | null
          executor_real?: string | null
          id?: string
          largura_pav_prevista?: number | null
          largura_pav_real?: number | null
          largura_vala?: number | null
          largura_vala_real?: number | null
          liberado?: boolean
          liberado_para?: string | null
          ligacoes_previstas?: number | null
          ligacoes_real?: number | null
          material_entregue_em?: string | null
          material_entregue_por?: string | null
          pav_extensoes_previsto?: Json | null
          pav_extensoes_real?: Json | null
          pav_m2_previsto?: number | null
          pav_m2_real?: number | null
          pav_previsto?: string | null
          pav_real?: string | null
          prazo_arredondado?: number | null
          prazo_previsto?: number | null
          prazo_real?: number | null
          prof_jusante?: number | null
          prof_jusante_real?: number | null
          prof_media_executada?: number | null
          prof_media_prevista?: number | null
          prof_media_real?: number | null
          prof_montante?: number | null
          prof_montante_real?: number | null
          pv_jusante?: string | null
          pv_montante?: string | null
          status?: Database["public"]["Enums"]["os_status"]
          trecho: string
          updated_at?: string
        }
        Update: {
          areia?: string | null
          areia_real?: string | null
          as_built_lat?: number | null
          as_built_lng?: number | null
          bacia?: string
          bms?: string | null
          bms_real?: string | null
          bomba_rebaixo?: boolean | null
          brita?: string | null
          brita_real?: string | null
          comprimento_previsto?: number | null
          comprimento_real?: number | null
          created_at?: string
          dn?: number | null
          dn_real?: number | null
          executor?: string | null
          executor_real?: string | null
          id?: string
          largura_pav_prevista?: number | null
          largura_pav_real?: number | null
          largura_vala?: number | null
          largura_vala_real?: number | null
          liberado?: boolean
          liberado_para?: string | null
          ligacoes_previstas?: number | null
          ligacoes_real?: number | null
          material_entregue_em?: string | null
          material_entregue_por?: string | null
          pav_extensoes_previsto?: Json | null
          pav_extensoes_real?: Json | null
          pav_m2_previsto?: number | null
          pav_m2_real?: number | null
          pav_previsto?: string | null
          pav_real?: string | null
          prazo_arredondado?: number | null
          prazo_previsto?: number | null
          prazo_real?: number | null
          prof_jusante?: number | null
          prof_jusante_real?: number | null
          prof_media_executada?: number | null
          prof_media_prevista?: number | null
          prof_media_real?: number | null
          prof_montante?: number | null
          prof_montante_real?: number | null
          pv_jusante?: string | null
          pv_montante?: string | null
          status?: Database["public"]["Enums"]["os_status"]
          trecho?: string
          updated_at?: string
        }
        Relationships: []
      }
      os_status_historico: {
        Row: {
          created_at: string
          id: string
          observacao: string | null
          os_id: string
          status_anterior: Database["public"]["Enums"]["os_status"] | null
          status_novo: Database["public"]["Enums"]["os_status"]
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          observacao?: string | null
          os_id: string
          status_anterior?: Database["public"]["Enums"]["os_status"] | null
          status_novo: Database["public"]["Enums"]["os_status"]
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          observacao?: string | null
          os_id?: string
          status_anterior?: Database["public"]["Enums"]["os_status"] | null
          status_novo?: Database["public"]["Enums"]["os_status"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "os_status_historico_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      registros_producao: {
        Row: {
          comprimento_dia: number
          created_at: string
          data_registro: string
          id: string
          ligacoes_dia: number
          observacao: string | null
          os_id: string
          tipo_pavimento: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          comprimento_dia?: number
          created_at?: string
          data_registro?: string
          id?: string
          ligacoes_dia?: number
          observacao?: string | null
          os_id: string
          tipo_pavimento?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          comprimento_dia?: number
          created_at?: string
          data_registro?: string
          id?: string
          ligacoes_dia?: number
          observacao?: string | null
          os_id?: string
          tipo_pavimento?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "registros_producao_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      topografia_asbuilt: {
        Row: {
          coord_e: number | null
          coord_n: number | null
          created_at: string
          encarregado: string | null
          id: string
          latitude: number | null
          longitude: number | null
          nome_estaca: string | null
          ns_relacionada: string | null
          observacao: string | null
          os_id: string
          profundidade: number | null
          registrado_por: string | null
        }
        Insert: {
          coord_e?: number | null
          coord_n?: number | null
          created_at?: string
          encarregado?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          nome_estaca?: string | null
          ns_relacionada?: string | null
          observacao?: string | null
          os_id: string
          profundidade?: number | null
          registrado_por?: string | null
        }
        Update: {
          coord_e?: number | null
          coord_n?: number | null
          created_at?: string
          encarregado?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          nome_estaca?: string | null
          ns_relacionada?: string | null
          observacao?: string | null
          os_id?: string
          profundidade?: number | null
          registrado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "topografia_asbuilt_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
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
      app_role:
        | "gerencia"
        | "sala_tecnica"
        | "almoxarifado"
        | "encarregado"
        | "topografo"
        | "admin"
      os_status: "VERMELHO" | "AMARELO" | "VERDE" | "CINZA" | "LARANJA"
      pv_tipo: "PV" | "TIL" | "TL"
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
      app_role: [
        "gerencia",
        "sala_tecnica",
        "almoxarifado",
        "encarregado",
        "topografo",
        "admin",
      ],
      os_status: ["VERMELHO", "AMARELO", "VERDE", "CINZA", "LARANJA"],
      pv_tipo: ["PV", "TIL", "TL"],
    },
  },
} as const
