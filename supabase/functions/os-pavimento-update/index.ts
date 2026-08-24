// Edge Function: os-pavimento-update
// Integração externa restrita: atualiza em lote SOMENTE ordens_servico.pav_previsto.
// - POST + Authorization: Bearer <PAVIMENTO_API_TOKEN> (token exclusivo desta integração)
// - Corpo estrito: { itens: [{ os_id: uuid, pav_previsto: 'Terra'|'Asfalto'|'Paralelepípedo' }] }
// - Atômico via RPC set_os_pav_previsto_lote (nenhum outro campo é tocado)
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_ITENS = 200;

// Valores oficiais gravados (idênticos ao seletor do encarregado)
const SOLO = 'Solo Natural';
const ASFALTO = 'Asfalto';
const PARALELO = 'Paralelepipedo';
const OFICIAIS = [
  SOLO,
  ASFALTO,
  PARALELO,
  `${SOLO} / ${ASFALTO}`,
  `${SOLO} / ${PARALELO}`,
  `${ASFALTO} / ${PARALELO}`,
  `${SOLO} / ${ASFALTO} / ${PARALELO}`,
];

// Sinônimos aceitos por componente
const SINONIMOS: Record<string, string> = {
  'terra': SOLO,
  'terreno natural': SOLO,
  'solo natural': SOLO,
  'asfalto': ASFALTO,
  'paralelo': PARALELO,
  'paralelepipedo': PARALELO,
  'paralelepipelo': PARALELO,
};

const semAcento = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');

// Normaliza qualquer entrada (simples ou combinada) para um valor oficial, ou null.
function normalizarPav(entrada: string): string | null {
  const partes = entrada.split(/[\/+,]| e /i).map((p) => semAcento(p)).filter((p) => p.length > 0);
  if (partes.length === 0) return null;

  const set = new Set<string>();
  for (const p of partes) {
    const canon = SINONIMOS[p];
    if (!canon) return null;
    set.add(canon);
  }

  // Ordem oficial: Solo Natural / Asfalto / Paralelepipedo
  const ordenado = [SOLO, ASFALTO, PARALELO].filter((v) => set.has(v)).join(' / ');
  return OFICIAIS.includes(ordenado) ? ordenado : null;
}


function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

type Item = { os_id: string; pav: string };

function validar(body: unknown): { itens: Item[] } | { erro: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { erro: 'Corpo inválido.' };
  const keys = Object.keys(body as Record<string, unknown>);
  const extras = keys.filter((k) => k !== 'itens');
  if (extras.length) return { erro: `Chaves não permitidas no corpo: ${extras.join(', ')}` };

  const raw = (body as { itens?: unknown }).itens;
  if (!Array.isArray(raw)) return { erro: '"itens" deve ser uma lista.' };
  if (raw.length === 0) return { erro: '"itens" não pode ser vazio.' };
  if (raw.length > MAX_ITENS) return { erro: `Máximo de ${MAX_ITENS} itens por requisição.` };

  const vistos = new Set<string>();
  const itens: Item[] = [];

  for (let i = 0; i < raw.length; i++) {
    const it = raw[i];
    if (!it || typeof it !== 'object' || Array.isArray(it)) return { erro: `Item ${i}: formato inválido.` };
    const ik = Object.keys(it as Record<string, unknown>);
    const iExtras = ik.filter((k) => k !== 'os_id' && k !== 'pav_previsto');
    if (iExtras.length) return { erro: `Item ${i}: chaves não permitidas: ${iExtras.join(', ')}` };

    const { os_id, pav_previsto } = it as { os_id?: unknown; pav_previsto?: unknown };
    if (typeof os_id !== 'string' || !UUID_RE.test(os_id.trim())) {
      return { erro: `Item ${i}: "os_id" deve ser um UUID válido.` };
    }
    const id = os_id.trim().toLowerCase();
    if (vistos.has(id)) return { erro: `Item ${i}: "os_id" repetido na lista.` };
    vistos.add(id);

    if (typeof pav_previsto !== 'string' || !(pav_previsto.trim() in PAV_MAP)) {
      return { erro: `Item ${i}: "pav_previsto" deve ser um de: ${Object.keys(PAV_MAP).join(', ')}` };
    }
    itens.push({ os_id: id, pav: PAV_MAP[pav_previsto.trim()] });
  }

  return { itens };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const requisicaoId = crypto.randomUUID();

  if (req.method !== 'POST') {
    return json({ sucesso: false, erro: 'Método não permitido.', requisicao_id: requisicaoId }, 405);
  }

  const TOKEN = Deno.env.get('PAVIMENTO_API_TOKEN');
  if (!TOKEN) return json({ sucesso: false, erro: 'Serviço indisponível.', requisicao_id: requisicaoId }, 503);

  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ') || !timingSafeEqual(auth.slice(7).trim(), TOKEN)) {
    return json({ sucesso: false, erro: 'Não autorizado.', requisicao_id: requisicaoId }, 401);
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  const auditar = async (
    itensRecebidos: number,
    atualizados: number,
    inalterados: number,
    sucesso: boolean,
    osIds: string[],
    erro?: string,
  ) => {
    try {
      await admin.from('os_pavimento_update_log').insert({
        requisicao_id: requisicaoId,
        itens_recebidos: itensRecebidos,
        atualizados,
        inalterados,
        sucesso,
        os_ids: osIds,
        erro: erro ? erro.slice(0, 300) : null,
      });
    } catch {
      /* auditoria não deve quebrar a resposta */
    }
  };

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    await auditar(0, 0, 0, false, [], 'json_invalido');
    return json({ sucesso: false, erro: 'JSON inválido.', requisicao_id: requisicaoId }, 400);
  }

  const val = validar(body);
  if ('erro' in val) {
    await auditar(0, 0, 0, false, [], `validacao: ${val.erro}`);
    return json({ sucesso: false, erro: val.erro, requisicao_id: requisicaoId }, 400);
  }

  const osIds = val.itens.map((i) => i.os_id);

  const { data, error } = await admin.rpc('set_os_pav_previsto_lote', {
    _itens: val.itens.map((i) => ({ os_id: i.os_id, pav_previsto: i.pav })),
  });

  if (error) {
    const msg = String(error.message ?? '');
    let publico = 'Não foi possível aplicar a atualização.';
    let status = 500;
    if (msg.includes('ns_inexistente')) {
      const ids = msg.split('ns_inexistente:')[1]?.split(/[^0-9a-fA-F-]/).filter((s) => UUID_RE.test(s)) ?? [];
      publico = `N.S. não encontrada(s): ${ids.join(', ')}. Nenhum registro foi alterado.`;
      status = 422;
    } else if (msg.includes('pavimento_invalido')) {
      publico = 'Valor de pavimento não permitido. Nenhum registro foi alterado.';
      status = 400;
    } else if (msg.includes('lista_vazia')) {
      publico = 'Lista de itens vazia.';
      status = 400;
    }
    await auditar(osIds.length, 0, 0, false, osIds, publico);
    return json({ sucesso: false, atualizados: 0, inalterados: 0, erro: publico, requisicao_id: requisicaoId }, status);
  }

  const res = (data ?? {}) as { atualizados?: number; inalterados?: number };
  const atualizados = Number(res.atualizados ?? 0);
  const inalterados = Number(res.inalterados ?? 0);

  await auditar(osIds.length, atualizados, inalterados, true, osIds);

  return json({ sucesso: true, atualizados, inalterados, requisicao_id: requisicaoId });
});
