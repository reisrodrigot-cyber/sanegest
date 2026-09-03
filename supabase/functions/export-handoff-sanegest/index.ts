// Edge Function: export-handoff-sanegest (TEMPORÁRIA)
// Exporta um ZIP de referência (somente leitura) para recriação corporativa do SaneGest.
// Acesso: apenas usuários autenticados com papel `admin`.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import JSZip from 'npm:jszip@3.10.1';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const EXPORTER_VERSION = '1.0.0';

const TABLES = [
  'profiles', 'user_roles', 'ordens_servico', 'estacas', 'ligacoes',
  'materiais_entrega', 'registros_producao', 'registros_producao_auditoria',
  'os_status_historico', 'os_revisoes', 'quantitativos_referencia',
  'topografia_asbuilt', 'mapa_bases', 'mapa_camadas', 'mapa_camadas_geo',
  'mapa_pontos', 'mapa_pv_operacional', 'mapa_trecho_operacional',
  'mapa_trecho_os', 'mapa_trechos', 'mapa_divergencias',
  'mapa_asbuilt_config', 'mapa_vinculos_auditoria', 'kmz_layer_groups',
  'registros_pavimentacao', 'os_liberacao_pavimentacao',
  'os_pavimentacao_conclusao', 'os_pavimento_update_log',
  'pav_normalizacao_log', 'import_logs', 'export_logs',
];

const BUCKETS = ['mapa-base', 'mapa-kmz', 'avatars'];

const EXCLUIDOS = [
  'auth.users e qualquer hash de senha',
  'sessões, refresh tokens e JWTs',
  'secrets e variáveis de ambiente (inclusive service role e tokens de API)',
  'chaves de integrações externas',
  'views (recriadas pelas migrations)',
  'binários do Storage (exportados em etapa separada)',
];

const PAGE = 1000;

async function fetchAllRows(table: string): Promise<any[]> {
  const rows: any[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin.from(table).select('*').range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return rows;
}

async function listBucket(bucket: string) {
  const out: { bucket: string; path: string; mime_type: string | null; size_bytes: number | null }[] = [];
  const walk = async (prefix: string) => {
    const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
    if (error || !data) return;
    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null && !(item as any).metadata) {
        await walk(path);
      } else {
        out.push({
          bucket,
          path,
          mime_type: (item as any).metadata?.mimetype ?? null,
          size_bytes: (item as any).metadata?.size ?? null,
        });
      }
    }
  };
  await walk('');
  return out;
}

const LEIA_PRIMEIRO = `# LEIA PRIMEIRO — Entrega técnica SaneGest

Este pacote é uma **referência para recriação corporativa** do SaneGest.

## O que este pacote é
- Um retrato somente leitura dos dados operacionais das tabelas base do banco.
- Material de apoio para que outra equipe recrie o sistema em ambiente próprio.

## O que este pacote NÃO é
- **Não é um backup restaurável** e não recompõe o ambiente original.
- Não contém estrutura de autenticação, secrets ou credenciais.

## Pontos obrigatórios na recriação
1. **Usuários devem ser recriados/reconvidados** no ambiente de destino. Nenhuma conta de
   autenticação, senha ou sessão foi exportada. As tabelas \`profiles\` e \`user_roles\`
   servem apenas como referência de perfis e papéis operacionais.
2. **Secrets e credenciais devem ser novos** no ambiente de destino (tokens de integração,
   chaves de API, service role). Nada disso foi incluído aqui.
3. **Os binários do Storage serão exportados em etapa separada.** Este pacote contém apenas
   o manifesto (\`storage-manifest.json\`) com bucket, caminho, tipo e tamanho dos objetos.
4. O schema, as views, funções, triggers e políticas de RLS são recriados pelas
   **migrations** do repositório de código, não por este pacote.

## Conteúdo
- \`database/<tabela>.json\` — um arquivo por tabela base (arquivos vazios quando a tabela não tem registros).
- \`storage-manifest.json\` — inventário dos objetos de Storage (sem URLs assinadas).
- \`MANIFESTO_EXPORTACAO.json\` — metadados, contagens, limitações e exclusões de segurança.
`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método não permitido' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    return new Response(JSON.stringify({ error: 'Não autenticado' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  const user = userData?.user;
  if (userErr || !user) {
    return new Response(JSON.stringify({ error: 'Sessão inválida' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: roleRow } = await admin
    .from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
  if (!roleRow) {
    return new Response(JSON.stringify({ error: 'Acesso restrito a administradores' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const filename = `sanegest_dados_referencia_${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}_${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}.zip`;

  const counts: Record<string, number> = {};
  try {
    const zip = new JSZip();
    const db = zip.folder('database')!;

    for (const table of TABLES) {
      const rows = await fetchAllRows(table);
      counts[table] = rows.length;
      db.file(`${table}.json`, JSON.stringify(rows, null, 2));
    }

    const storageObjects: any[] = [];
    const bucketsInfo: { bucket: string; objetos: number }[] = [];
    for (const b of BUCKETS) {
      const objs = await listBucket(b);
      storageObjects.push(...objs);
      bucketsInfo.push({ bucket: b, objetos: objs.length });
    }
    zip.file('storage-manifest.json', JSON.stringify({
      gerado_em: now.toISOString(),
      observacao: 'Somente inventário. Nenhuma URL assinada incluída. Binários exportados em etapa separada.',
      buckets: bucketsInfo,
      objetos: storageObjects,
    }, null, 2));

    const totalRegistros = Object.values(counts).reduce((a, b) => a + b, 0);

    zip.file('MANIFESTO_EXPORTACAO.json', JSON.stringify({
      gerado_em: now.toISOString(),
      versao_exportador: EXPORTER_VERSION,
      finalidade: 'Referência para recriação corporativa do SaneGest (não é backup restaurável)',
      tabelas_incluidas: TABLES,
      registros_por_tabela: counts,
      total_registros: totalRegistros,
      buckets_identificados: bucketsInfo,
      limitacoes: [
        'Não restaura o ambiente original.',
        'Contas de autenticação não são exportadas; usuários devem ser recriados/reconvidados.',
        'Views não são exportadas como dados; são recriadas pelas migrations.',
        'Binários do Storage não estão incluídos, apenas o manifesto.',
        'Sequências, extensões, RLS, funções e triggers vêm das migrations do repositório.',
      ],
      excluido_por_seguranca: EXCLUIDOS,
    }, null, 2));

    zip.file('LEIA_PRIMEIRO.md', LEIA_PRIMEIRO);

    const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });

    await admin.from('export_logs').insert({
      actor: user.email ?? 'admin',
      user_id: user.id,
      source: 'export-handoff-sanegest',
      registros_count: totalRegistros,
      status: 'sucesso',
      filename,
    });

    return new Response(bytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    await admin.from('export_logs').insert({
      actor: user.email ?? 'admin',
      user_id: user.id,
      source: 'export-handoff-sanegest',
      registros_count: Object.values(counts).reduce((a, b) => a + b, 0),
      status: 'erro',
      error: msg,
      filename,
    });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
