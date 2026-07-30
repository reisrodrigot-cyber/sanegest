// Edge Function: assistant-query
// Acesso externo SOMENTE LEITURA para o assistente operacional (Rick/Hermes).
// - Autenticação por token estático em Authorization: Bearer <ASSISTANT_API_TOKEN>
// - Nenhuma escrita nos dados operacionais (apenas log de acesso)
// - Sem SQL livre: apenas 5 operações com parâmetros validados
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const OPERACOES = [
  'buscar_ns',
  'ns_detalhe',
  'producao_periodo',
  'produtividade_encarregado',
  'avanco_por_bacia',
] as const;
type Operacao = typeof OPERACOES[number];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function texto(v: unknown, max = 120): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}

async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405);

  const TOKEN = Deno.env.get('ASSISTANT_API_TOKEN');
  if (!TOKEN) return json({ error: 'Serviço indisponível' }, 503);

  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ') || !timingSafeEqual(auth.slice(7).trim(), TOKEN)) {
    return json({ error: 'Não autorizado' }, 401);
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  let operacao = 'desconhecida';
  let paramsHash: string | null = null;

  const log = async (sucesso: boolean, count: number | null, erro?: string) => {
    try {
      await admin.from('assistant_access_log').insert({
        operacao,
        sucesso,
        registros_retornados: count,
        params_hash: paramsHash,
        erro: erro ? erro.slice(0, 200) : null,
      });
    } catch { /* log não deve quebrar a resposta */ }
  };

  try {
    const body = await req.json().catch(() => ({}));
    const params = (body?.params ?? {}) as Record<string, unknown>;
    operacao = typeof body?.operacao === 'string' ? body.operacao : 'desconhecida';
    paramsHash = await sha256(JSON.stringify(params));

    if (!OPERACOES.includes(operacao as Operacao)) {
      await log(false, null, 'operacao_invalida');
      return json({ error: 'Operação não permitida', operacoes: OPERACOES }, 400);
    }

    let data: unknown;
    let error: { message: string } | null = null;

    switch (operacao as Operacao) {
      case 'buscar_ns': {
        const termo = texto(params.termo);
        if (!termo || termo.length < 2) {
          await log(false, null, 'termo_invalido');
          return json({ error: 'Informe "termo" com pelo menos 2 caracteres.' }, 400);
        }
        const limite = Math.min(Math.max(Number(params.limite) || 20, 1), 100);
        ({ data, error } = await admin.rpc('assistant_buscar_ns', { _termo: termo, _limit: limite }));
        break;
      }
      case 'ns_detalhe': {
        const osId = texto(params.os_id, 40);
        const bacia = texto(params.bacia);
        const trecho = texto(params.trecho);
        if (osId && !UUID_RE.test(osId)) {
          await log(false, null, 'os_id_invalido');
          return json({ error: '"os_id" inválido.' }, 400);
        }
        if (!osId && !(bacia && trecho)) {
          await log(false, null, 'parametros_insuficientes');
          return json({ error: 'Informe "os_id" ou "bacia" + "trecho".' }, 400);
        }
        ({ data, error } = await admin.rpc('assistant_ns_detalhe', {
          _os_id: osId, _bacia: bacia, _trecho: trecho,
        }));
        break;
      }
      case 'producao_periodo': {
        const di = texto(params.data_inicial, 10);
        const df = texto(params.data_final, 10);
        if (!di || !df || !DATE_RE.test(di) || !DATE_RE.test(df) || df < di) {
          await log(false, null, 'periodo_invalido');
          return json({ error: 'Informe "data_inicial" e "data_final" em AAAA-MM-DD, com final >= inicial.' }, 400);
        }
        ({ data, error } = await admin.rpc('assistant_producao_periodo', {
          _data_inicial: di,
          _data_final: df,
          _bacia: texto(params.bacia),
          _encarregado: texto(params.encarregado),
          _limit: Math.min(Math.max(Number(params.limite) || 500, 1), 2000),
        }));
        break;
      }
      case 'produtividade_encarregado': {
        const di = texto(params.data_inicial, 10);
        const df = texto(params.data_final, 10);
        if (!di || !df || !DATE_RE.test(di) || !DATE_RE.test(df) || df < di) {
          await log(false, null, 'periodo_invalido');
          return json({ error: 'Informe "data_inicial" e "data_final" em AAAA-MM-DD, com final >= inicial.' }, 400);
        }
        ({ data, error } = await admin.rpc('assistant_produtividade_encarregado', {
          _data_inicial: di, _data_final: df, _encarregado: texto(params.encarregado),
        }));
        break;
      }
      case 'avanco_por_bacia': {
        ({ data, error } = await admin.rpc('assistant_avanco_por_bacia', { _bacia: texto(params.bacia) }));
        break;
      }
    }

    if (error) {
      await log(false, null, error.message);
      return json({ error: 'Falha ao consultar os dados.' }, 500);
    }

    const count = Array.isArray(data) ? data.length : data ? 1 : 0;
    await log(true, count);
    return json({ operacao, count, data: data ?? null });
  } catch (err) {
    await log(false, null, String(err));
    return json({ error: 'Requisição inválida.' }, 400);
  }
});
