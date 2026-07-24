import { supabase } from '@/integrations/supabase/client';
import {
  normalizarRotulo,
  chaveCandidata,
  classificarTipoNo,
  bboxFromCoords,
  sha256Hex,
  PENDENCIAS_CONHECIDAS_SS08,
  PENDENCIA_CHAVES,
} from './mapaBaseNormalize';

import type { ImportPayload, ImportError } from '@/workers/shpImport.worker';

const CHUNK = 200;

export type ImportProgress = (msg: string) => void;

export type ImportResumo = {
  base_id: string;
  ss: string;
  versao: number;
  feicoes_rede: number;
  feicoes_pv: number;
  vinculos_auto: number;
  divergencias: number;
  ns_sem_linha: number;
  linhas_sem_ns: number;
  colisoes: number;
};

function parseZipInWorker(buffer: ArrayBuffer): Promise<ImportPayload> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('../workers/shpImport.worker.ts', import.meta.url),
      { type: 'module' }
    );
    worker.onmessage = (e: MessageEvent<ImportPayload | ImportError>) => {
      worker.terminate();
      if ((e.data as any).ok) resolve(e.data as ImportPayload);
      else reject(new Error((e.data as ImportError).error));
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(new Error(e.message || 'Erro no worker de importação'));
    };
    worker.postMessage({ buffer }, [buffer]);
  });
}

function extractLine(geom: any): Array<[number, number]> {
  if (!geom) return [];
  if (geom.type === 'LineString') return geom.coordinates;
  if (geom.type === 'MultiLineString') {
    return (geom.coordinates as number[][][]).flat() as Array<[number, number]>;
  }
  return [];
}

function extractPoint(geom: any): [number, number] | null {
  if (!geom) return null;
  if (geom.type === 'Point') return geom.coordinates as [number, number];
  if (geom.type === 'MultiPoint' && geom.coordinates?.length) return geom.coordinates[0];
  return null;
}

// Normaliza identificações equivalentes: "ss10", "SS 10", "ss-10" → "SS-10"
// Também reconhece sufixos: "ss13a", "SS 13 A", "SS-13B" → "SS-13A" / "SS-13B"
export function normalizarSS(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = String(raw).toUpperCase().match(/SS[\s\-_]*0*(\d{1,3})[\s\-_]*([AB])?(?![0-9])/);
  if (!m) return null;
  const num = m[1].padStart(2, '0');
  const suf = m[2] ?? '';
  return `SS-${num}${suf}`;
}

// Detecta a SS analisando nome do arquivo e nomes de camadas do shapefile
export function detectarSSDoConteudo(fileName: string, nomesCamadas: string[]): string | null {
  const fromFile = normalizarSS(fileName);
  if (fromFile) return fromFile;
  for (const nc of nomesCamadas) {
    const s = normalizarSS(nc);
    if (s) return s;
  }
  return null;
}

// —— Fluxo principal ——
export async function importarBase(
  file: File,
  ssSelecionada: string,
  userId: string | null,
  onProgress: ImportProgress
): Promise<ImportResumo> {
  const ss = normalizarSS(ssSelecionada);
  if (!ss) throw new Error('SS inválida. Selecione a SS antes de importar.');

  onProgress('Calculando hash do arquivo...');
  const buf = await file.arrayBuffer();
  const bufCopy = buf.slice(0); // worker consome via transfer
  const hash = await sha256Hex(bufCopy);

  // Valida SS identificada no nome do arquivo (se detectável) contra a selecionada
  const ssArquivo = normalizarSS(file.name);
  if (ssArquivo && ssArquivo !== ss) {
    throw new Error(
      `Divergência: arquivo identificado como ${ssArquivo}, mas a importação está configurada como ${ss}. Corrija antes de continuar.`
    );
  }

  // Descobre próxima versão APENAS dentro da SS atual
  const { data: last } = await supabase
    .from('mapa_bases' as any)
    .select('versao')
    .eq('ss', ss)
    .order('versao', { ascending: false })
    .limit(1)
    .maybeSingle();
  const versao = ((last as any)?.versao ?? 0) + 1;

  onProgress(`Enviando arquivo para storage (versão ${versao})...`);
  const arquivoPath = `${ss.toLowerCase()}/v${versao}/${hash}.zip`;
  const { error: upErr } = await supabase.storage
    .from('mapa-base')
    .upload(arquivoPath, file, { contentType: 'application/zip', upsert: false });
  if (upErr && !/exists|Duplicate/i.test(upErr.message)) throw upErr;

  onProgress('Criando registro da base (status: processando)...');
  const { data: baseIns, error: baseErr } = await supabase
    .from('mapa_bases' as any)
    .insert({
      ss,
      versao,
      status: 'processando',
      arquivo_path: arquivoPath,
      arquivo_hash: hash,
      arquivo_bytes: file.size,
      importado_por: userId,
    } as any)
    .select('id')
    .single();
  if (baseErr) throw baseErr;
  const baseId = (baseIns as any).id as string;

  const finalizarComFalha = async (motivo: string) => {
    await supabase.from('mapa_bases' as any)
      .update({ status: 'falha', motivo_falha: motivo } as any)
      .eq('id', baseId);
    // dados parciais serão removidos por ON DELETE CASCADE ao apagar a base,
    // mas mantemos a base para auditoria; removemos filhos:
    await supabase.from('mapa_trechos' as any).delete().eq('base_id', baseId);
    await supabase.from('mapa_pontos' as any).delete().eq('base_id', baseId);
    await supabase.from('mapa_camadas_geo' as any).delete().eq('base_id', baseId);
  };

  try {
    onProgress('Analisando shapefile no Web Worker...');
    const payload = await parseZipInWorker(buf);

    // Valida SS detectada no conteúdo (nomes de camadas) contra a selecionada
    const nomesCamadas = payload.camadas.map((c) => c.nome_camada);
    const ssConteudo = detectarSSDoConteudo(file.name, nomesCamadas);
    if (ssConteudo && ssConteudo !== ss) {
      throw new Error(
        `Divergência: conteúdo identificado como ${ssConteudo}, mas a importação está configurada como ${ss}. Corrija antes de continuar.`
      );
    }

    // Identifica camadas oficiais
    const rede = payload.camadas.find(
      (c) => c.tipo === 'LINESTRING' && /REDE/i.test(c.nome_camada)
    ) ?? payload.camadas.find((c) => c.tipo === 'LINESTRING');
    const pv = payload.camadas.find(
      (c) => c.tipo === 'POINT' && /(PV|PONTO|NOD)/i.test(c.nome_camada)
    ) ?? payload.camadas.find((c) => c.tipo === 'POINT');

    if (!rede) throw new Error('Nenhuma camada LINESTRING encontrada no ZIP.');
    if (!pv) throw new Error('Nenhuma camada POINT encontrada no ZIP.');

    onProgress(`SS identificada: ${ssConteudo ?? ss} — REDE: ${rede.nome_camada} (${rede.features.length}), PV: ${pv.nome_camada} (${pv.features.length})`);

    // Registrar camadas
    await supabase.from('mapa_camadas_geo' as any).insert([
      { base_id: baseId, tipo: 'LINESTRING', nome_camada: rede.nome_camada, campos_originais: rede.campos, feicoes: rede.features.length },
      { base_id: baseId, tipo: 'POINT', nome_camada: pv.nome_camada, campos_originais: pv.campos, feicoes: pv.features.length },
    ]);

    // ---- Trechos ----
    onProgress('Persistindo trechos...');
    const trechoRows = rede.features.map((f) => {
      const p = f.properties || {};
      const rotulo = String(p['RÓTULO'] ?? p['ROTULO'] ?? p['rotulo'] ?? '').trim();
      const coords = extractLine(f.geometry);
      const bbox = bboxFromCoords(coords);
      return {
        base_id: baseId,
        rotulo_original: rotulo,
        rotulo_chave: normalizarRotulo(rotulo),
        no_inicial: p['NO_INICIAL'] ?? p['NO_INI'] ?? null,
        no_final: p['NO_FINAL'] ?? p['NO_FIM'] ?? null,
        no_iniid: p['NO_INIID'] != null ? String(p['NO_INIID']) : null,
        no_finid: p['NO_FINID'] != null ? String(p['NO_FINID']) : null,
        dn: p['D'] != null ? Number(p['D']) : null,
        material: p['MATERIAL'] ?? null,
        l_escala: p['L_ESCALA'] != null ? Number(p['L_ESCALA']) : null,
        inv_inic: p['INV_INIC'] != null ? Number(p['INV_INIC']) : null,
        inv_fim: p['INV_FIM'] != null ? Number(p['INV_FIM']) : null,
        declividade: p['S'] != null ? Number(p['S']) : null,
        geometry: f.geometry as any,
        min_lon: bbox?.min_lon ?? null,
        min_lat: bbox?.min_lat ?? null,
        max_lon: bbox?.max_lon ?? null,
        max_lat: bbox?.max_lat ?? null,
        atributos_extra: p,
      };
    });
    for (let i = 0; i < trechoRows.length; i += CHUNK) {
      const { error } = await supabase.from('mapa_trechos' as any).insert(trechoRows.slice(i, i + CHUNK) as any);
      if (error) throw error;
    }

    // ---- Pontos ----
    onProgress('Persistindo PV/TL/TQ...');
    const pontoRows = pv.features.map((f) => {
      const p = f.properties || {};
      const rotulo = String(p['RÓTULO'] ?? p['ROTULO'] ?? p['rotulo'] ?? '').trim();
      const c = extractPoint(f.geometry);
      return {
        base_id: baseId,
        rotulo_original: rotulo,
        rotulo_chave: normalizarRotulo(rotulo),
        tipo_no: classificarTipoNo(rotulo),
        cota_marg: p['COTA_MARG'] != null ? Number(p['COTA_MARG']) : null,
        cota_inv: p['COTA_INV'] != null ? Number(p['COTA_INV']) : null,
        prof: p['PROF_C'] != null ? Number(p['PROF_C']) : (p['PROF'] != null ? Number(p['PROF']) : null),
        geometry: f.geometry as any,
        lon: c?.[0] ?? null,
        lat: c?.[1] ?? null,
        atributos_extra: p,
      };
    });
    for (let i = 0; i < pontoRows.length; i += CHUNK) {
      const { error } = await supabase.from('mapa_pontos' as any).insert(pontoRows.slice(i, i + CHUNK) as any);
      if (error) throw error;
    }

    // ---- Reconciliação (2 níveis: chave exata → chave candidata) ----
    onProgress('Reconciliando trechos com N.S...');
    const { data: trechosInseridos } = await supabase
      .from('mapa_trechos' as any)
      .select('id, rotulo_original, rotulo_chave, no_inicial, no_final')
      .eq('base_id', baseId);
    // Busca N.S. ativas (com paginação — pode haver > 1000 no total)
    const PAGE = 1000;
    const nsAll: any[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from('ordens_servico')
        .select('id, trecho, bacia, status_vigencia, pv_montante, pv_jusante')
        .range(from, from + PAGE - 1);
      if (error) throw error;
      const rows = (data ?? []) as any[];
      nsAll.push(...rows);
      if (rows.length < PAGE) break;
    }
    const nsAtivas = nsAll.filter((n) => (n as any).status_vigencia !== 'SUPRIMIDO');

    // Índices dos dois lados por chave EXATA e por chave CANDIDATA
    const nsByChave = new Map<string, any[]>();
    const nsByCand = new Map<string, any[]>();
    for (const n of nsAtivas) {
      const chave = normalizarRotulo((n as any).trecho);
      const cand = chaveCandidata(chave);
      (nsByChave.get(chave) ?? nsByChave.set(chave, []).get(chave)!).push(n);
      (nsByCand.get(cand) ?? nsByCand.set(cand, []).get(cand)!).push(n);
    }
    const shpChaveCount = new Map<string, number>();
    const shpCandCount = new Map<string, number>();
    for (const t of trechosInseridos ?? []) {
      const chave = (t as any).rotulo_chave as string;
      const cand = chaveCandidata(chave);
      shpChaveCount.set(chave, (shpChaveCount.get(chave) ?? 0) + 1);
      shpCandCount.set(cand, (shpCandCount.get(cand) ?? 0) + 1);
    }

    const vinculos: any[] = [];
    const divergencias: any[] = [];
    const chavesReconhecidas = new Set<string>(); // qualquer chave/candidato coberto por trecho SHP

    const nosCompativeis = (t: any, ns: any): { ok: boolean; detalhe: string | null } => {
      const ti = normalizarRotulo(t.no_inicial);
      const tf = normalizarRotulo(t.no_final);
      const nm = normalizarRotulo(ns.pv_montante);
      const nj = normalizarRotulo(ns.pv_jusante);
      if (!nm && !nj) return { ok: true, detalhe: null }; // NS sem PVs cadastrados
      if (!ti && !tf) return { ok: true, detalhe: null }; // SHP sem nós
      // aceita mesma orientação ou invertida
      const same = (ti === nm && tf === nj);
      const flipped = (ti === nj && tf === nm);
      if (same || flipped) return { ok: true, detalhe: null };
      return { ok: false, detalhe: `SHP(${ti}→${tf}) vs NS(${nm}→${nj})` };
    };

    for (const t of trechosInseridos ?? []) {
      const chave = (t as any).rotulo_chave as string;
      const rotulo = (t as any).rotulo_original as string;
      const cand = chaveCandidata(chave);

      // pendência conhecida (aplica-se apenas à SS-08)
      if (ss === 'SS-08' && PENDENCIA_CHAVES.has(chave)) {
        divergencias.push({
          base_id: baseId,
          tipo: 'AMBIGUO',
          rotulo,
          detalhes: {
            trecho_id: (t as any).id,
            motivo: PENDENCIAS_CONHECIDAS_SS08.find((p) => normalizarRotulo(p.rotulo) === chave)?.motivo,
          },
        });
        continue;
      }
      // colisão dentro da própria REDE (mesma chave exata)
      if ((shpChaveCount.get(chave) ?? 0) > 1) {
        divergencias.push({
          base_id: baseId, tipo: 'COLISAO', rotulo,
          detalhes: { trecho_id: (t as any).id, motivo: 'Rótulo duplicado dentro da REDE (chave exata)' },
        });
        continue;
      }

      // 1) match EXATO
      const exatas = nsByChave.get(chave) ?? [];
      if (exatas.length === 1) {
        const conf = nosCompativeis(t, exatas[0]);
        vinculos.push({
          trecho_id: (t as any).id,
          os_id: exatas[0].id,
          origem: 'AUTO',
          criado_por: userId,
          motivo: `Match exato por rótulo${conf.ok ? '' : ' (nós divergentes — revisar)'}`,
        });
        // Divergência de nós é apenas uma observação registrada no motivo do vínculo
        // (não conta como ambiguidade; o vínculo AUTO segue válido).
        chavesReconhecidas.add(chave);
        chavesReconhecidas.add(cand);
        continue;
      }
      if (exatas.length > 1) {
        divergencias.push({
          base_id: baseId, tipo: 'AMBIGUO', rotulo,
          detalhes: { trecho_id: (t as any).id, motivo: 'Múltiplas N.S. com o mesmo rótulo exato', candidatas_os_ids: exatas.map((c) => c.id) },
        });
        continue;
      }

      // 2) match por CANDIDATA — só se única dos dois lados
      if ((shpCandCount.get(cand) ?? 0) > 1) {
        divergencias.push({
          base_id: baseId, tipo: 'COLISAO', rotulo,
          detalhes: { trecho_id: (t as any).id, motivo: `Candidato "${cand}" colide com outro trecho da REDE`, chave_candidata: cand },
        });
        continue;
      }
      // NS que casam pelo candidato (por chave OU por candidato, deduplicando)
      const nsCandMatchMap = new Map<string, any>();
      for (const n of (nsByChave.get(cand) ?? [])) nsCandMatchMap.set(n.id, n);
      for (const n of (nsByCand.get(cand) ?? [])) nsCandMatchMap.set(n.id, n);
      const nsCandMatch = Array.from(nsCandMatchMap.values());

      if (nsCandMatch.length === 0) {
        divergencias.push({
          base_id: baseId, tipo: 'SEM_NS', rotulo,
          detalhes: { trecho_id: (t as any).id, chave_candidata: cand },
        });
        continue;
      }
      if (nsCandMatch.length > 1) {
        divergencias.push({
          base_id: baseId, tipo: 'AMBIGUO', rotulo,
          detalhes: {
            trecho_id: (t as any).id,
            motivo: 'Múltiplas N.S. reconhecidas pela chave candidata',
            chave_candidata: cand,
            candidatas_os_ids: nsCandMatch.map((c) => c.id),
          },
        });
        continue;
      }

      const ns = nsCandMatch[0];
      const conf = nosCompativeis(t, ns);
      vinculos.push({
        trecho_id: (t as any).id,
        os_id: ns.id,
        origem: 'AUTO',
        criado_por: userId,
        motivo: `Match por chave candidata (${chave} ↔ ${normalizarRotulo(ns.trecho)})${conf.ok ? '' : ' — nós divergentes (revisar)'}`,
      });
      // Nós divergentes ficam apenas anotados no motivo do vínculo — não geram divergência.
      chavesReconhecidas.add(chave);
      chavesReconhecidas.add(cand);
    }

    // N.S. sem linha: a chave OU candidato da N.S. (da bacia importada) não aparece no SHP
    const shpAll = new Set<string>();
    for (const t of trechosInseridos ?? []) {
      const chv = (t as any).rotulo_chave as string;
      shpAll.add(chv);
      shpAll.add(chaveCandidata(chv));
    }
    // Regex do código da SS (SS-08 → /SS[\-\s]?0?8/) para filtrar N.S. da bacia atual
    const ssNum = ss.replace(/^SS-/, '');
    const ssBaciaRegex = new RegExp(`SS[\\-\\s]?0?${Number(ssNum)}`);
    let nsSemLinha = 0;
    for (const n of nsAtivas) {
      const bacia = normalizarRotulo((n as any).bacia);
      if (!ssBaciaRegex.test(bacia)) continue;
      const chv = normalizarRotulo((n as any).trecho);
      const cnd = chaveCandidata(chv);
      if (!shpAll.has(chv) && !shpAll.has(cnd)) {
        nsSemLinha++;
        divergencias.push({
          base_id: baseId, tipo: 'SEM_LINHA', rotulo: (n as any).trecho,
          detalhes: { os_id: (n as any).id, bacia: (n as any).bacia },
        });
      }
    }


    // insere vínculos e divergências
    for (let i = 0; i < vinculos.length; i += CHUNK) {
      const { error } = await supabase.from('mapa_trecho_os' as any).insert(vinculos.slice(i, i + CHUNK) as any);
      if (error) throw error;
    }
    for (let i = 0; i < divergencias.length; i += CHUNK) {
      const { error } = await supabase.from('mapa_divergencias' as any).insert(divergencias.slice(i, i + CHUNK) as any);
      if (error) throw error;
    }

    const linhasSemNs = divergencias.filter((d) => d.tipo === 'SEM_NS').length;
    const colisoesCount = divergencias.filter((d) => d.tipo === 'COLISAO').length;

    onProgress('Finalizando (status: preview)...');
    await supabase.from('mapa_bases' as any).update({
      status: 'preview',
      feicoes_rede: rede.features.length,
      feicoes_pv: pv.features.length,
      bbox: { min_lon: payload.bbox[0], min_lat: payload.bbox[1], max_lon: payload.bbox[2], max_lat: payload.bbox[3] },
      relatorio_validacao: {
        camada_rede: rede.nome_camada,
        camada_pv: pv.nome_camada,
        vinculos_auto: vinculos.length,
        divergencias: divergencias.length,
        ns_sem_linha: nsSemLinha,
        linhas_sem_ns: linhasSemNs,
        colisoes: colisoesCount,
        campos_rede: rede.campos,
        campos_pv: pv.campos,
      },
    } as any).eq('id', baseId);

    return {
      base_id: baseId,
      ss, versao,
      feicoes_rede: rede.features.length,
      feicoes_pv: pv.features.length,
      vinculos_auto: vinculos.length,
      divergencias: divergencias.length,
      ns_sem_linha: nsSemLinha,
      linhas_sem_ns: linhasSemNs,
      colisoes: colisoesCount,
    };
  } catch (err: any) {
    await finalizarComFalha(err?.message ?? String(err));
    throw err;
  }
}
