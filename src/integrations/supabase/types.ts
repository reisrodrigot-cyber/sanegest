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
      assistant_access_log: {
        Row: {
          created_at: string
          erro: string | null
          id: string
          operacao: string
          params_hash: string | null
          registros_retornados: number | null
          sucesso: boolean
        }
        Insert: {
          created_at?: string
          erro?: string | null
          id?: string
          operacao: string
          params_hash?: string | null
          registros_retornados?: number | null
          sucesso: boolean
        }
        Update: {
          created_at?: string
          erro?: string | null
          id?: string
          operacao?: string
          params_hash?: string | null
          registros_retornados?: number | null
          sucesso?: boolean
        }
        Relationships: []
      }
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
          {
            foreignKeyName: "estacas_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "relatorio_producao_diaria"
            referencedColumns: ["os_id"]
          },
        ]
      }
      export_logs: {
        Row: {
          actor: string
          created_at: string
          error: string | null
          exported_at: string
          filename: string | null
          id: string
          registros_count: number | null
          source: string
          status: string
          user_id: string | null
        }
        Insert: {
          actor: string
          created_at?: string
          error?: string | null
          exported_at?: string
          filename?: string | null
          id?: string
          registros_count?: number | null
          source?: string
          status: string
          user_id?: string | null
        }
        Update: {
          actor?: string
          created_at?: string
          error?: string | null
          exported_at?: string
          filename?: string | null
          id?: string
          registros_count?: number | null
          source?: string
          status?: string
          user_id?: string | null
        }
        Relationships: []
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
          ajustado_em: string | null
          ajustado_por: string | null
          comprimento: number | null
          comprimento_original: number | null
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
          ajustado_em?: string | null
          ajustado_por?: string | null
          comprimento?: number | null
          comprimento_original?: number | null
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
          ajustado_em?: string | null
          ajustado_por?: string | null
          comprimento?: number | null
          comprimento_original?: number | null
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
            foreignKeyName: "ligacoes_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "relatorio_producao_diaria"
            referencedColumns: ["os_id"]
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
      mapa_bases: {
        Row: {
          arquivo_bytes: number | null
          arquivo_hash: string | null
          arquivo_path: string | null
          bbox: Json | null
          created_at: string
          excluida_em: string | null
          excluida_por: string | null
          feicoes_pv: number | null
          feicoes_rede: number | null
          id: string
          importado_por: string | null
          motivo_exclusao: string | null
          motivo_falha: string | null
          promovido_em: string | null
          promovido_por: string | null
          relatorio_validacao: Json | null
          ss: string
          status: Database["public"]["Enums"]["mapa_base_status"]
          updated_at: string
          versao: number
        }
        Insert: {
          arquivo_bytes?: number | null
          arquivo_hash?: string | null
          arquivo_path?: string | null
          bbox?: Json | null
          created_at?: string
          excluida_em?: string | null
          excluida_por?: string | null
          feicoes_pv?: number | null
          feicoes_rede?: number | null
          id?: string
          importado_por?: string | null
          motivo_exclusao?: string | null
          motivo_falha?: string | null
          promovido_em?: string | null
          promovido_por?: string | null
          relatorio_validacao?: Json | null
          ss: string
          status?: Database["public"]["Enums"]["mapa_base_status"]
          updated_at?: string
          versao: number
        }
        Update: {
          arquivo_bytes?: number | null
          arquivo_hash?: string | null
          arquivo_path?: string | null
          bbox?: Json | null
          created_at?: string
          excluida_em?: string | null
          excluida_por?: string | null
          feicoes_pv?: number | null
          feicoes_rede?: number | null
          id?: string
          importado_por?: string | null
          motivo_exclusao?: string | null
          motivo_falha?: string | null
          promovido_em?: string | null
          promovido_por?: string | null
          relatorio_validacao?: Json | null
          ss?: string
          status?: Database["public"]["Enums"]["mapa_base_status"]
          updated_at?: string
          versao?: number
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
      mapa_camadas_geo: {
        Row: {
          base_id: string
          campos_originais: Json | null
          created_at: string
          feicoes: number | null
          id: string
          nome_camada: string
          tipo: Database["public"]["Enums"]["mapa_camada_tipo"]
        }
        Insert: {
          base_id: string
          campos_originais?: Json | null
          created_at?: string
          feicoes?: number | null
          id?: string
          nome_camada: string
          tipo: Database["public"]["Enums"]["mapa_camada_tipo"]
        }
        Update: {
          base_id?: string
          campos_originais?: Json | null
          created_at?: string
          feicoes?: number | null
          id?: string
          nome_camada?: string
          tipo?: Database["public"]["Enums"]["mapa_camada_tipo"]
        }
        Relationships: [
          {
            foreignKeyName: "mapa_camadas_geo_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "mapa_bases"
            referencedColumns: ["id"]
          },
        ]
      }
      mapa_divergencias: {
        Row: {
          base_id: string
          created_at: string
          detalhes: Json | null
          id: string
          resolucao: string | null
          resolvido_em: string | null
          resolvido_por: string | null
          rotulo: string | null
          status: Database["public"]["Enums"]["mapa_divergencia_status"]
          tipo: Database["public"]["Enums"]["mapa_divergencia_tipo"]
          updated_at: string
        }
        Insert: {
          base_id: string
          created_at?: string
          detalhes?: Json | null
          id?: string
          resolucao?: string | null
          resolvido_em?: string | null
          resolvido_por?: string | null
          rotulo?: string | null
          status?: Database["public"]["Enums"]["mapa_divergencia_status"]
          tipo: Database["public"]["Enums"]["mapa_divergencia_tipo"]
          updated_at?: string
        }
        Update: {
          base_id?: string
          created_at?: string
          detalhes?: Json | null
          id?: string
          resolucao?: string | null
          resolvido_em?: string | null
          resolvido_por?: string | null
          rotulo?: string | null
          status?: Database["public"]["Enums"]["mapa_divergencia_status"]
          tipo?: Database["public"]["Enums"]["mapa_divergencia_tipo"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mapa_divergencias_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "mapa_bases"
            referencedColumns: ["id"]
          },
        ]
      }
      mapa_pontos: {
        Row: {
          atributos_extra: Json | null
          base_id: string
          cota_inv: number | null
          cota_marg: number | null
          created_at: string
          geometry: Json
          id: string
          lat: number | null
          lon: number | null
          prof: number | null
          rotulo_chave: string
          rotulo_original: string
          tipo_no: Database["public"]["Enums"]["mapa_ponto_tipo"]
        }
        Insert: {
          atributos_extra?: Json | null
          base_id: string
          cota_inv?: number | null
          cota_marg?: number | null
          created_at?: string
          geometry: Json
          id?: string
          lat?: number | null
          lon?: number | null
          prof?: number | null
          rotulo_chave: string
          rotulo_original: string
          tipo_no?: Database["public"]["Enums"]["mapa_ponto_tipo"]
        }
        Update: {
          atributos_extra?: Json | null
          base_id?: string
          cota_inv?: number | null
          cota_marg?: number | null
          created_at?: string
          geometry?: Json
          id?: string
          lat?: number | null
          lon?: number | null
          prof?: number | null
          rotulo_chave?: string
          rotulo_original?: string
          tipo_no?: Database["public"]["Enums"]["mapa_ponto_tipo"]
        }
        Relationships: [
          {
            foreignKeyName: "mapa_pontos_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "mapa_bases"
            referencedColumns: ["id"]
          },
        ]
      }
      mapa_pv_operacional: {
        Row: {
          base_id: string
          cota: number | null
          created_at: string
          geom: Json
          id: string
          lat: number
          lon: number
          motivo: string | null
          observacao: string | null
          ponto_origem_id: string | null
          profundidade: number | null
          rotulo: string
          tipo: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          base_id: string
          cota?: number | null
          created_at?: string
          geom: Json
          id?: string
          lat: number
          lon: number
          motivo?: string | null
          observacao?: string | null
          ponto_origem_id?: string | null
          profundidade?: number | null
          rotulo: string
          tipo: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          base_id?: string
          cota?: number | null
          created_at?: string
          geom?: Json
          id?: string
          lat?: number
          lon?: number
          motivo?: string | null
          observacao?: string | null
          ponto_origem_id?: string | null
          profundidade?: number | null
          rotulo?: string
          tipo?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mapa_pv_operacional_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "mapa_bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mapa_pv_operacional_ponto_origem_id_fkey"
            columns: ["ponto_origem_id"]
            isOneToOne: false
            referencedRelation: "mapa_pontos"
            referencedColumns: ["id"]
          },
        ]
      }
      mapa_trecho_operacional: {
        Row: {
          base_id: string
          created_at: string
          dn: number | null
          extensao_m: number | null
          geom: Json
          id: string
          material: string | null
          motivo: string | null
          pv_final_id: string
          pv_inicial_id: string
          rotulo: string
          tipo: string
          trecho_origem_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          base_id: string
          created_at?: string
          dn?: number | null
          extensao_m?: number | null
          geom: Json
          id?: string
          material?: string | null
          motivo?: string | null
          pv_final_id: string
          pv_inicial_id: string
          rotulo: string
          tipo: string
          trecho_origem_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          base_id?: string
          created_at?: string
          dn?: number | null
          extensao_m?: number | null
          geom?: Json
          id?: string
          material?: string | null
          motivo?: string | null
          pv_final_id?: string
          pv_inicial_id?: string
          rotulo?: string
          tipo?: string
          trecho_origem_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mapa_trecho_operacional_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "mapa_bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mapa_trecho_operacional_pv_final_id_fkey"
            columns: ["pv_final_id"]
            isOneToOne: false
            referencedRelation: "mapa_pv_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mapa_trecho_operacional_pv_inicial_id_fkey"
            columns: ["pv_inicial_id"]
            isOneToOne: false
            referencedRelation: "mapa_pv_operacional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mapa_trecho_operacional_trecho_origem_id_fkey"
            columns: ["trecho_origem_id"]
            isOneToOne: false
            referencedRelation: "mapa_trechos"
            referencedColumns: ["id"]
          },
        ]
      }
      mapa_trecho_os: {
        Row: {
          ativo: boolean
          created_at: string
          criado_por: string | null
          desativado_em: string | null
          desativado_por: string | null
          fracao: number
          id: string
          motivo: string | null
          origem: Database["public"]["Enums"]["mapa_vinculo_origem"]
          os_id: string
          trecho_id: string
          trecho_operacional_id: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          criado_por?: string | null
          desativado_em?: string | null
          desativado_por?: string | null
          fracao?: number
          id?: string
          motivo?: string | null
          origem?: Database["public"]["Enums"]["mapa_vinculo_origem"]
          os_id: string
          trecho_id: string
          trecho_operacional_id?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          criado_por?: string | null
          desativado_em?: string | null
          desativado_por?: string | null
          fracao?: number
          id?: string
          motivo?: string | null
          origem?: Database["public"]["Enums"]["mapa_vinculo_origem"]
          os_id?: string
          trecho_id?: string
          trecho_operacional_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mapa_trecho_os_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mapa_trecho_os_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "relatorio_producao_diaria"
            referencedColumns: ["os_id"]
          },
          {
            foreignKeyName: "mapa_trecho_os_trecho_id_fkey"
            columns: ["trecho_id"]
            isOneToOne: false
            referencedRelation: "mapa_trechos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mapa_trecho_os_trecho_operacional_id_fkey"
            columns: ["trecho_operacional_id"]
            isOneToOne: false
            referencedRelation: "mapa_trecho_operacional"
            referencedColumns: ["id"]
          },
        ]
      }
      mapa_trechos: {
        Row: {
          atributos_extra: Json | null
          base_id: string
          created_at: string
          declividade: number | null
          dn: number | null
          geometry: Json
          id: string
          inv_fim: number | null
          inv_inic: number | null
          l_escala: number | null
          material: string | null
          max_lat: number | null
          max_lon: number | null
          min_lat: number | null
          min_lon: number | null
          no_final: string | null
          no_finid: string | null
          no_inicial: string | null
          no_iniid: string | null
          rotulo_chave: string
          rotulo_original: string
        }
        Insert: {
          atributos_extra?: Json | null
          base_id: string
          created_at?: string
          declividade?: number | null
          dn?: number | null
          geometry: Json
          id?: string
          inv_fim?: number | null
          inv_inic?: number | null
          l_escala?: number | null
          material?: string | null
          max_lat?: number | null
          max_lon?: number | null
          min_lat?: number | null
          min_lon?: number | null
          no_final?: string | null
          no_finid?: string | null
          no_inicial?: string | null
          no_iniid?: string | null
          rotulo_chave: string
          rotulo_original: string
        }
        Update: {
          atributos_extra?: Json | null
          base_id?: string
          created_at?: string
          declividade?: number | null
          dn?: number | null
          geometry?: Json
          id?: string
          inv_fim?: number | null
          inv_inic?: number | null
          l_escala?: number | null
          material?: string | null
          max_lat?: number | null
          max_lon?: number | null
          min_lat?: number | null
          min_lon?: number | null
          no_final?: string | null
          no_finid?: string | null
          no_inicial?: string | null
          no_iniid?: string | null
          rotulo_chave?: string
          rotulo_original?: string
        }
        Relationships: [
          {
            foreignKeyName: "mapa_trechos_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "mapa_bases"
            referencedColumns: ["id"]
          },
        ]
      }
      mapa_vinculos_auditoria: {
        Row: {
          acao: string
          antes: Json | null
          created_at: string
          depois: Json | null
          id: string
          os_id: string | null
          trecho_id: string | null
          user_id: string | null
          vinculo_id: string | null
        }
        Insert: {
          acao: string
          antes?: Json | null
          created_at?: string
          depois?: Json | null
          id?: string
          os_id?: string | null
          trecho_id?: string | null
          user_id?: string | null
          vinculo_id?: string | null
        }
        Update: {
          acao?: string
          antes?: Json | null
          created_at?: string
          depois?: Json | null
          id?: string
          os_id?: string | null
          trecho_id?: string | null
          user_id?: string | null
          vinculo_id?: string | null
        }
        Relationships: []
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
          {
            foreignKeyName: "materiais_entrega_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "relatorio_producao_diaria"
            referencedColumns: ["os_id"]
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
          real_validado: boolean
          real_validado_em: string | null
          real_validado_por: string | null
          status: Database["public"]["Enums"]["os_status"]
          status_vigencia: string
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
          real_validado?: boolean
          real_validado_em?: string | null
          real_validado_por?: string | null
          status?: Database["public"]["Enums"]["os_status"]
          status_vigencia?: string
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
          real_validado?: boolean
          real_validado_em?: string | null
          real_validado_por?: string | null
          status?: Database["public"]["Enums"]["os_status"]
          status_vigencia?: string
          trecho?: string
          updated_at?: string
        }
        Relationships: []
      }
      os_revisoes: {
        Row: {
          areia: string | null
          bacia: string | null
          bms: string | null
          bomba_rebaixo: boolean | null
          brita: string | null
          comprimento_previsto: number | null
          created_at: string
          dn: number | null
          id: string
          import_log_id: string | null
          imported_at: string
          largura_pav_prevista: number | null
          largura_vala: number | null
          ligacoes_previstas: number | null
          os_id: string
          pav_m2_previsto: number | null
          pav_previsto: string | null
          prazo_arredondado: number | null
          prazo_previsto: number | null
          prof_jusante: number | null
          prof_media_prevista: number | null
          prof_montante: number | null
          pv_jusante: string | null
          pv_montante: string | null
          rotulo: string
          suprimido: boolean
          trecho: string | null
          user_id: string | null
          versao: number
        }
        Insert: {
          areia?: string | null
          bacia?: string | null
          bms?: string | null
          bomba_rebaixo?: boolean | null
          brita?: string | null
          comprimento_previsto?: number | null
          created_at?: string
          dn?: number | null
          id?: string
          import_log_id?: string | null
          imported_at?: string
          largura_pav_prevista?: number | null
          largura_vala?: number | null
          ligacoes_previstas?: number | null
          os_id: string
          pav_m2_previsto?: number | null
          pav_previsto?: string | null
          prazo_arredondado?: number | null
          prazo_previsto?: number | null
          prof_jusante?: number | null
          prof_media_prevista?: number | null
          prof_montante?: number | null
          pv_jusante?: string | null
          pv_montante?: string | null
          rotulo: string
          suprimido?: boolean
          trecho?: string | null
          user_id?: string | null
          versao: number
        }
        Update: {
          areia?: string | null
          bacia?: string | null
          bms?: string | null
          bomba_rebaixo?: boolean | null
          brita?: string | null
          comprimento_previsto?: number | null
          created_at?: string
          dn?: number | null
          id?: string
          import_log_id?: string | null
          imported_at?: string
          largura_pav_prevista?: number | null
          largura_vala?: number | null
          ligacoes_previstas?: number | null
          os_id?: string
          pav_m2_previsto?: number | null
          pav_previsto?: string | null
          prazo_arredondado?: number | null
          prazo_previsto?: number | null
          prof_jusante?: number | null
          prof_media_prevista?: number | null
          prof_montante?: number | null
          pv_jusante?: string | null
          pv_montante?: string | null
          rotulo?: string
          suprimido?: boolean
          trecho?: string | null
          user_id?: string | null
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "os_revisoes_import_log_id_fkey"
            columns: ["import_log_id"]
            isOneToOne: false
            referencedRelation: "import_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "os_revisoes_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "os_revisoes_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "relatorio_producao_diaria"
            referencedColumns: ["os_id"]
          },
        ]
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
          {
            foreignKeyName: "os_status_historico_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "relatorio_producao_diaria"
            referencedColumns: ["os_id"]
          },
        ]
      }
      profiles: {
        Row: {
          apelido: string | null
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
          apelido?: string | null
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
          apelido?: string | null
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
      quantitativos_referencia: {
        Row: {
          bacia_chave: string
          bacia_exibicao: string
          created_at: string
          created_by: string | null
          id: string
          linha_recalque_prevista_metros: number
          ramais_previstos_unidades: number
          rede_prevista_metros: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          bacia_chave: string
          bacia_exibicao: string
          created_at?: string
          created_by?: string | null
          id?: string
          linha_recalque_prevista_metros?: number
          ramais_previstos_unidades?: number
          rede_prevista_metros?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          bacia_chave?: string
          bacia_exibicao?: string
          created_at?: string
          created_by?: string | null
          id?: string
          linha_recalque_prevista_metros?: number
          ramais_previstos_unidades?: number
          rede_prevista_metros?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      registros_producao: {
        Row: {
          ajustado_em: string | null
          ajustado_por: string | null
          cancelado_em: string | null
          cancelado_por: string | null
          comprimento_ajustado: number | null
          comprimento_dia: number
          created_at: string
          data_registro: string
          data_retroativa_confirmada: boolean
          excluido: boolean
          excluido_em: string | null
          excluido_por: string | null
          id: string
          ligacoes_ajustadas: number | null
          ligacoes_dia: number
          motivo_ajuste: string | null
          motivo_cancelamento: string | null
          motivo_exclusao: string | null
          observacao: string | null
          os_id: string
          pv_final_assentado: boolean
          pv_final_assentado_em: string | null
          pv_final_assentado_por: string | null
          status: string
          tipo_pavimento: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ajustado_em?: string | null
          ajustado_por?: string | null
          cancelado_em?: string | null
          cancelado_por?: string | null
          comprimento_ajustado?: number | null
          comprimento_dia?: number
          created_at?: string
          data_registro?: string
          data_retroativa_confirmada?: boolean
          excluido?: boolean
          excluido_em?: string | null
          excluido_por?: string | null
          id?: string
          ligacoes_ajustadas?: number | null
          ligacoes_dia?: number
          motivo_ajuste?: string | null
          motivo_cancelamento?: string | null
          motivo_exclusao?: string | null
          observacao?: string | null
          os_id: string
          pv_final_assentado?: boolean
          pv_final_assentado_em?: string | null
          pv_final_assentado_por?: string | null
          status?: string
          tipo_pavimento?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ajustado_em?: string | null
          ajustado_por?: string | null
          cancelado_em?: string | null
          cancelado_por?: string | null
          comprimento_ajustado?: number | null
          comprimento_dia?: number
          created_at?: string
          data_registro?: string
          data_retroativa_confirmada?: boolean
          excluido?: boolean
          excluido_em?: string | null
          excluido_por?: string | null
          id?: string
          ligacoes_ajustadas?: number | null
          ligacoes_dia?: number
          motivo_ajuste?: string | null
          motivo_cancelamento?: string | null
          motivo_exclusao?: string | null
          observacao?: string | null
          os_id?: string
          pv_final_assentado?: boolean
          pv_final_assentado_em?: string | null
          pv_final_assentado_por?: string | null
          status?: string
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
          {
            foreignKeyName: "registros_producao_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "relatorio_producao_diaria"
            referencedColumns: ["os_id"]
          },
        ]
      }
      registros_producao_auditoria: {
        Row: {
          acao: string
          criado_em: string
          id: string
          registro_producao_id: string
          usuario_id: string | null
          valor_anterior: Json | null
          valor_novo: Json | null
        }
        Insert: {
          acao: string
          criado_em?: string
          id?: string
          registro_producao_id: string
          usuario_id?: string | null
          valor_anterior?: Json | null
          valor_novo?: Json | null
        }
        Update: {
          acao?: string
          criado_em?: string
          id?: string
          registro_producao_id?: string
          usuario_id?: string | null
          valor_anterior?: Json | null
          valor_novo?: Json | null
        }
        Relationships: []
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
          {
            foreignKeyName: "topografia_asbuilt_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "relatorio_producao_diaria"
            referencedColumns: ["os_id"]
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
      relatorio_producao_diaria: {
        Row: {
          comprimento_total_ligacoes: number | null
          comprimento_trecho_executado: number | null
          data_producao: string | null
          encarregado: string | null
          liberado_para: string | null
          ligacoes_detalhadas: number | null
          obra_id: string | null
          obra_nome: string | null
          observacao_conclusao: string | null
          os_id: string | null
          pv_final_assentado: boolean | null
          pv_final_assentado_em: string | null
          pv_final_assentado_por_nome: string | null
          quantidade_ligacoes_realizadas: number | null
          real_validado: boolean | null
          responsavel_nome: string | null
          responsavel_user_id: string | null
          trecho: string | null
          updated_at: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      assistant_avanco_por_bacia: {
        Args: { _bacia?: string }
        Returns: {
          bacia: string
          executado_m: number
          ligacoes_comprimento_m: number
          ns_concluidas: number
          ns_total: number
          pendente_m: number
          previsto_m: number
        }[]
      }
      assistant_buscar_ns: {
        Args: { _limit?: number; _termo: string }
        Returns: {
          bacia: string
          liberado: boolean
          os_id: string
          pv_jusante: string
          pv_montante: string
          responsavel: string
          status: string
          trecho: string
        }[]
      }
      assistant_ns_detalhe: {
        Args: { _bacia?: string; _os_id?: string; _trecho?: string }
        Returns: Json
      }
      assistant_producao_periodo: {
        Args: {
          _bacia?: string
          _data_final: string
          _data_inicial: string
          _encarregado?: string
          _limit?: number
        }
        Returns: {
          bacia: string
          data_producao: string
          ligacoes_comprimento_m: number
          ligacoes_qtd: number
          os_id: string
          pv_final_assentado: boolean
          rede_m: number
          responsavel: string
          trecho: string
        }[]
      }
      assistant_produtividade_encarregado: {
        Args: {
          _data_final: string
          _data_inicial: string
          _encarregado?: string
        }
        Returns: {
          dias_com_rede: number
          ligacoes_comprimento_m: number
          ligacoes_qtd: number
          produtividade_rede_m_dia: number
          rede_m: number
          responsavel: string
        }[]
      }
      get_mapa_publico: { Args: { _ss: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      pode_gerenciar_mapa_base: { Args: { _user_id: string }; Returns: boolean }
      pode_ver_mapa_base_preview: {
        Args: { _user_id: string }
        Returns: boolean
      }
      recompute_os_real_from_registros: {
        Args: { _os_id: string }
        Returns: undefined
      }
      recompute_os_status: { Args: { _os_id: string }; Returns: undefined }
    }
    Enums: {
      app_role:
        | "gerencia"
        | "sala_tecnica"
        | "almoxarifado"
        | "encarregado"
        | "topografo"
        | "admin"
      mapa_base_status:
        | "processando"
        | "preview"
        | "falha"
        | "ativa"
        | "arquivada"
      mapa_camada_tipo: "LINESTRING" | "POINT"
      mapa_divergencia_status: "aberta" | "resolvida" | "ignorada"
      mapa_divergencia_tipo:
        | "COLISAO"
        | "SEM_NS"
        | "SEM_LINHA"
        | "AMBIGUO"
        | "SEM_GEOMETRIA"
        | "OUTRO"
      mapa_ponto_tipo: "PV" | "TL" | "TQ" | "OUTRO"
      mapa_vinculo_origem: "AUTO" | "MANUAL"
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
      mapa_base_status: [
        "processando",
        "preview",
        "falha",
        "ativa",
        "arquivada",
      ],
      mapa_camada_tipo: ["LINESTRING", "POINT"],
      mapa_divergencia_status: ["aberta", "resolvida", "ignorada"],
      mapa_divergencia_tipo: [
        "COLISAO",
        "SEM_NS",
        "SEM_LINHA",
        "AMBIGUO",
        "SEM_GEOMETRIA",
        "OUTRO",
      ],
      mapa_ponto_tipo: ["PV", "TL", "TQ", "OUTRO"],
      mapa_vinculo_origem: ["AUTO", "MANUAL"],
      os_status: ["VERMELHO", "AMARELO", "VERDE", "CINZA", "LARANJA"],
      pv_tipo: ["PV", "TIL", "TL"],
    },
  },
} as const
