import { useState } from 'react';
import { Loader2, TrendingUp, Pencil } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuantitativosContratuais } from '@/hooks/useQuantitativosContratuais';
import { QuantidadesContratuaisModal } from './QuantidadesContratuaisModal';
import { useAvancoFisico } from '@/hooks/useAvancoFisico';
import type { LinhaAvanco, OrdemLike } from '@/lib/avancoFisico';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';


const fmtM = (n: number) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtUn = (n: number) => Math.round(n).toLocaleString('pt-BR');
const fmtPct = (p: number | null) =>
  p == null ? '—' : `${p.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
/** Percentual que nunca exibe vazio (usado na Linha de Recalque). */
const fmtPct0 = (p: number | null) =>
  `${(p ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

interface Props {
  ordens: OrdemLike[];
}

const CardResumo = ({
  titulo, redePrev, redeReal, redePct, ramaisPrev, ramaisReal, ramaisPct,
  lrPrev, lrReal, lrPct, accent,
}: {
  titulo: string; redePrev: number; redeReal: number; redePct: number | null;
  ramaisPrev: number; ramaisReal: number; ramaisPct: number | null;
  lrPrev: number; lrReal: number; lrPct: number | null; accent: string;
}) => (
  <div
    className="bg-card rounded-lg border border-border shadow-sm p-4 flex flex-col gap-3"
    style={{ borderTop: `3px solid ${accent}` }}
  >
    <div className="flex items-center justify-between text-muted-foreground">
      <span className="text-xs font-semibold uppercase tracking-wide">{titulo}</span>
      <TrendingUp size={16} style={{ color: accent }} />
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Rede</div>
        <div className="text-2xl font-bold text-foreground leading-tight tabular-nums break-words">{fmtPct(redePct)}</div>
        <dl className="mt-1 space-y-0.5 text-xs text-muted-foreground">
          <div className="flex justify-between gap-2"><dt>Previsto</dt><dd className="tabular-nums text-foreground">{fmtM(redePrev)} m</dd></div>
          <div className="flex justify-between gap-2"><dt>Realizado</dt><dd className="tabular-nums text-foreground">{fmtM(redeReal)} m</dd></div>
          <div className="flex justify-between gap-2"><dt>Saldo</dt><dd className="tabular-nums text-foreground">{fmtM(redePrev - redeReal)} m</dd></div>
        </dl>
      </div>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Ramais</div>
        <div className="text-2xl font-bold text-foreground leading-tight tabular-nums break-words">{fmtPct(ramaisPct)}</div>
        <dl className="mt-1 space-y-0.5 text-xs text-muted-foreground">
          <div className="flex justify-between gap-2"><dt>Previsto</dt><dd className="tabular-nums text-foreground">{fmtUn(ramaisPrev)} un.</dd></div>
          <div className="flex justify-between gap-2"><dt>Realizado</dt><dd className="tabular-nums text-foreground">{fmtUn(ramaisReal)} un.</dd></div>
          <div className="flex justify-between gap-2"><dt>Saldo</dt><dd className="tabular-nums text-foreground">{fmtUn(ramaisPrev - ramaisReal)} un.</dd></div>
        </dl>
      </div>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Linha de Recalque</div>
        <div className="text-2xl font-bold text-foreground leading-tight tabular-nums break-words">{fmtPct0(lrPct)}</div>
        <dl className="mt-1 space-y-0.5 text-xs text-muted-foreground">
          <div className="flex justify-between gap-2"><dt>Previsto</dt><dd className="tabular-nums text-foreground">{fmtM(lrPrev)} m</dd></div>
          <div className="flex justify-between gap-2"><dt>Realizado</dt><dd className="tabular-nums text-foreground">{fmtM(lrReal)} m</dd></div>
          <div className="flex justify-between gap-2"><dt>Saldo</dt><dd className="tabular-nums text-foreground">{fmtM(lrPrev - lrReal)} m</dd></div>
        </dl>
      </div>
    </div>
  </div>
);

const BarraPct = ({ pct }: { pct: number | null }) => (
  <div className="h-2 w-full rounded-full bg-muted overflow-hidden" aria-hidden>
    <div
      className="h-full rounded-full bg-primary"
      style={{ width: `${Math.min(100, Math.max(0, pct ?? 0))}%` }}
    />
  </div>
);

const AvancoSecao = ({
  titulo, linhas, unidade, formatar, contratualPorChave, formatarContratual, podeEditar, onEditar,
  mostrarContratual = true, saldoOperacional = false,
}: {
  titulo: string;
  linhas: LinhaAvanco[];
  unidade: string;
  formatar: (n: number) => string;
  contratualPorChave: Map<string, number | null>;
  formatarContratual: (n: number) => string;
  podeEditar: boolean;
  onEditar: () => void;
  /** Quando false, a seção mostra apenas Previsto/Realizado/Saldo/% (sem contratual). */
  mostrarContratual?: boolean;
  /** Quando true, o saldo exibido é Previsto − Realizado (não contratual). */
  saldoOperacional?: boolean;
}) => {
  const contratualTexto = (chave: string) => {
    const v = contratualPorChave.get(chave);
    return v == null ? '—' : formatarContratual(v);
  };
  const saldoContratualTexto = (chave: string, realizado: number) => {
    const v = contratualPorChave.get(chave);
    return v == null ? '—' : formatarContratual(v - realizado);
  };

  const previsto = linhas.reduce((s, l) => s + l.previsto, 0);
  const realizado = linhas.reduce((s, l) => s + l.realizado, 0);
  const pctTotal = previsto > 0 ? Math.round((realizado / previsto) * 1000) / 10 : null;
  const contratualTotal = linhas
    .map((l) => contratualPorChave.get(l.chave))
    .filter((v): v is number => v != null);
  const contratualTotalSoma = contratualTotal.length
    ? contratualTotal.reduce((a, b) => a + b, 0)
    : null;
  const realizadoComContratual = linhas
    .filter((l) => contratualPorChave.get(l.chave) != null)
    .reduce((s, l) => s + l.realizado, 0);

  const BotaoLapis = (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onEditar}
            aria-label="Editar quantidades contratuais"
            className="inline-flex items-center justify-center h-6 w-6 -my-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors align-middle"
          >
            <Pencil size={12} />
          </button>
        </TooltipTrigger>
        <TooltipContent>Editar quantidades contratuais</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  return (
    <div className="bg-card rounded-lg border border-border shadow-sm p-2.5 flex flex-col min-h-0">
      <div className="flex items-start justify-center gap-1 mb-2 min-h-[2.4em]">
        <h3 className="text-sm font-semibold text-foreground text-center leading-tight self-center">{titulo}</h3>
        {podeEditar && BotaoLapis}
      </div>

      {linhas.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">Sem dados.</p>
      ) : (
        <>
          {/* Mobile: cartões empilhados por sub-bacia */}
          <div className="md:hidden">
            {mostrarContratual && (
              <div className="flex items-center gap-1 pb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                <span>Qnt. Contratual ({unidade})</span>
                {podeEditar && BotaoLapis}
              </div>
            )}
            <ul className="flex flex-col gap-2">
              {linhas.map((l) => (
                <li key={l.chave} className="rounded-lg border border-border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-sm font-semibold text-foreground break-words">{l.exibicao}</span>
                    <span className="text-base font-bold text-foreground tabular-nums shrink-0">{fmtPct(l.pct)}</span>
                  </div>
                  <div className="mt-2"><BarraPct pct={l.pct} /></div>
                  <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    {mostrarContratual ? (
                      <>
                        <div className="min-w-0">
                          <dt className="text-muted-foreground">Qnt. Contratual</dt>
                          <dd className="tabular-nums font-medium text-foreground">{contratualTexto(l.chave)} {unidade}</dd>
                        </div>
                        <div className="min-w-0">
                          <dt className="text-muted-foreground">{saldoOperacional ? 'Saldo' : 'Saldo contratual'}</dt>
                          <dd className="tabular-nums font-medium text-foreground">{saldoOperacional ? formatar(l.saldo) : saldoContratualTexto(l.chave, l.realizado)} {unidade}</dd>
                        </div>

                      </>
                    ) : (
                      <div className="min-w-0">
                        <dt className="text-muted-foreground">Saldo</dt>
                        <dd className="tabular-nums font-medium text-foreground">{formatar(l.saldo)} {unidade}</dd>
                      </div>
                    )}
                    <div className="min-w-0">
                      <dt className="text-muted-foreground">Previsto</dt>
                      <dd className="tabular-nums font-medium text-foreground">{formatar(l.previsto)} {unidade}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-muted-foreground">Realizado</dt>
                      <dd className="tabular-nums font-medium text-foreground">{formatar(l.realizado)} {unidade}</dd>
                    </div>
                  </dl>
                  {!l.temPrevisto && (
                    <p className="mt-1 text-[11px] text-muted-foreground">Sem previsto em N.S. vigentes.</p>
                  )}
                </li>
              ))}
              <li className="rounded-lg border border-border bg-muted/40 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-foreground">Total</span>
                  <span className="text-base font-bold text-foreground tabular-nums">{fmtPct(pctTotal)}</span>
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  {mostrarContratual ? (
                    <>
                      <div><dt className="text-muted-foreground">Qnt. Contratual</dt><dd className="tabular-nums font-medium text-foreground">{contratualTotalSoma == null ? '—' : `${formatarContratual(contratualTotalSoma)} ${unidade}`}</dd></div>
                      <div><dt className="text-muted-foreground">{saldoOperacional ? 'Saldo' : 'Saldo contratual'}</dt><dd className="tabular-nums font-medium text-foreground">{saldoOperacional ? `${formatar(previsto - realizado)} ${unidade}` : (contratualTotalSoma == null ? '—' : `${formatarContratual(contratualTotalSoma - realizadoComContratual)} ${unidade}`)}</dd></div>
                    </>
                  ) : (
                    <div><dt className="text-muted-foreground">Saldo</dt><dd className="tabular-nums font-medium text-foreground">{formatar(previsto - realizado)} {unidade}</dd></div>
                  )}
                  <div><dt className="text-muted-foreground">Previsto</dt><dd className="tabular-nums font-medium text-foreground">{formatar(previsto)} {unidade}</dd></div>
                  <div><dt className="text-muted-foreground">Realizado</dt><dd className="tabular-nums font-medium text-foreground">{formatar(realizado)} {unidade}</dd></div>
                </dl>
              </li>
            </ul>
          </div>

          {/* Desktop: tabela */}
          <div className="hidden md:block overflow-auto max-h-[420px]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card">
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="pb-1 pr-2 font-medium leading-tight">Sub-bacia</th>
                  {mostrarContratual ? (
                    <>
                      <th className="pb-1 px-1.5 text-right font-normal leading-tight">
                        <span className="inline-flex items-center gap-1 justify-end">
                          Qnt.<br />Contratual<br />({unidade})
                          {podeEditar && BotaoLapis}
                        </span>
                      </th>
                      <th className="pb-1 px-1.5 font-medium text-right leading-tight">{saldoOperacional ? 'Saldo' : 'Saldo contratual'}<br />({unidade})</th>
                    </>
                  ) : (
                    <th className="pb-1 px-1.5 font-medium text-right leading-tight">Saldo<br />({unidade})</th>
                  )}
                  <th className="pb-1 px-1.5 font-medium text-right leading-tight">Previsto<br />({unidade})</th>
                  <th className="pb-1 px-1.5 font-medium text-right leading-tight">Realizado<br />({unidade})</th>
                  <th className="pb-1 pl-2 font-medium text-right leading-tight">%<br />Executado</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.chave} className="border-b border-border/40">
                    <td className="py-1.5 pr-2 text-foreground">{l.exibicao}</td>
                    {mostrarContratual ? (
                      <>
                        <td className="py-1.5 px-1.5 text-right tabular-nums text-muted-foreground font-normal">{contratualTexto(l.chave)}</td>
                        <td className="py-1.5 px-1.5 text-right tabular-nums">{saldoOperacional ? formatar(l.saldo) : saldoContratualTexto(l.chave, l.realizado)}</td>
                      </>
                    ) : (
                      <td className="py-1.5 px-1.5 text-right tabular-nums">{formatar(l.saldo)}</td>
                    )}
                    <td className="py-1.5 px-1.5 text-right tabular-nums">{formatar(l.previsto)}</td>
                    <td className="py-1.5 px-1.5 text-right tabular-nums">{formatar(l.realizado)}</td>
                    <td className="py-1.5 pl-2 text-right tabular-nums font-semibold">{fmtPct(l.pct)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border font-semibold">
                  <td className="py-1.5 pr-2 text-foreground">Total</td>
                  {mostrarContratual ? (
                    <>
                      <td className="py-1.5 px-1.5 text-right tabular-nums text-muted-foreground font-normal">
                        {contratualTotalSoma == null ? '—' : formatarContratual(contratualTotalSoma)}
                      </td>
                      <td className="py-1.5 px-1.5 text-right tabular-nums">
                        {saldoOperacional ? formatar(previsto - realizado) : (contratualTotalSoma == null ? '—' : formatarContratual(contratualTotalSoma - realizadoComContratual))}
                      </td>

                    </>
                  ) : (
                    <td className="py-1.5 px-1.5 text-right tabular-nums">{formatar(previsto - realizado)}</td>
                  )}
                  <td className="py-1.5 px-1.5 text-right tabular-nums">{formatar(previsto)}</td>
                  <td className="py-1.5 px-1.5 text-right tabular-nums">{formatar(realizado)}</td>
                  <td className="py-1.5 pl-2 text-right tabular-nums">{fmtPct(pctTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
};


/**
 * Ramais por sub-bacia — não usa previsto operacional de ligações.
 * Unidades e metros são contratuais manuais e independentes.
 */
const RamaisSecao = ({
  linhas, contratualUn, contratualM, podeEditar, onEditar,
}: {
  linhas: LinhaAvanco[];
  contratualUn: Map<string, number | null>;
  contratualM: Map<string, number | null>;
  podeEditar: boolean;
  onEditar: () => void;
}) => {
  const somaContratual = (m: Map<string, number | null>) => {
    const vals = linhas.map((l) => m.get(l.chave)).filter((v): v is number => v != null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
  };
  const totalRealUn = linhas.reduce((s, l) => s + l.realizado, 0);
  const totalRealM = linhas.reduce((s, l) => s + (l.realizadoM ?? 0), 0);
  const totContratualUn = somaContratual(contratualUn);
  const totContratualM = somaContratual(contratualM);
  const pctTotal = totContratualUn && totContratualUn > 0
    ? Math.round((totalRealUn / totContratualUn) * 1000) / 10
    : null;

  const saldoUn = (c: number | null | undefined, real: number) =>
    c == null || c === 0 ? '—' : fmtUn(c - real);
  const saldoM = (c: number | null | undefined, real: number) =>
    c == null || c === 0 ? '—' : fmtM(c - real);
  const pctLinha = (c: number | null | undefined, real: number) =>
    c == null || c === 0 ? null : Math.round((real / c) * 1000) / 10;

  const BotaoLapis = (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onEditar}
            aria-label="Editar quantidades contratuais"
            className="inline-flex items-center justify-center h-6 w-6 -my-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors align-middle"
          >
            <Pencil size={12} />
          </button>
        </TooltipTrigger>
        <TooltipContent>Editar quantidades contratuais</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  const divisor = 'border-l border-border/50';

  return (
    <div className="bg-card rounded-lg border border-border shadow-sm p-2.5 flex flex-col min-h-0">
      <div className="flex items-start justify-center gap-1 mb-2 min-h-[2.4em]">
        <h3 className="text-sm font-semibold text-foreground text-center leading-tight self-center">
          Ramais por<br />sub-bacia
        </h3>
        {podeEditar && BotaoLapis}
      </div>

      {linhas.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">Sem dados.</p>
      ) : (
        <>
          {/* Mobile */}
          <ul className="md:hidden flex flex-col gap-2">
            {linhas.map((l) => {
              const cUn = contratualUn.get(l.chave);
              const cM = contratualM.get(l.chave);
              const pct = pctLinha(cUn, l.realizado);
              return (
                <li key={l.chave} className="rounded-lg border border-border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-sm font-semibold text-foreground break-words">{l.exibicao}</span>
                    <span className="text-base font-bold text-foreground tabular-nums shrink-0">{fmtPct(pct)}</span>
                  </div>
                  <div className="mt-2"><BarraPct pct={pct} /></div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <dl className="space-y-0.5">
                      <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Qnt. Contratual</dt><dd className="tabular-nums font-medium text-foreground">{cUn == null ? '—' : fmtUn(cUn)} un.</dd></div>
                      <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Realizado</dt><dd className="tabular-nums font-medium text-foreground">{fmtUn(l.realizado)} un.</dd></div>
                      <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Saldo</dt><dd className="tabular-nums font-medium text-foreground">{saldoUn(cUn, l.realizado)}</dd></div>
                    </dl>
                    <dl className={`space-y-0.5 pl-2 ${divisor}`}>
                      <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Qnt. Contratual</dt><dd className="tabular-nums font-medium text-foreground">{cM == null ? '—' : fmtM(cM)} m</dd></div>
                      <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Realizado</dt><dd className="tabular-nums font-medium text-foreground">{fmtM(l.realizadoM ?? 0)} m</dd></div>
                      <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Saldo</dt><dd className="tabular-nums font-medium text-foreground">{saldoM(cM, l.realizadoM ?? 0)}</dd></div>
                    </dl>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Desktop */}
          <div className="hidden md:block overflow-auto max-h-[420px]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card">
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="pb-1 pr-2 font-medium leading-tight">Sub-bacia</th>
                  <th className="pb-1 px-1.5 text-right font-normal leading-tight">Qnt.<br />Contratual<br />(un.)</th>
                  <th className="pb-1 px-1.5 font-medium text-right leading-tight">Realizado<br />(un.)</th>
                  <th className="pb-1 px-1.5 font-medium text-right leading-tight">Saldo<br />(un.)</th>
                  <th className={`pb-1 px-1.5 text-right font-normal leading-tight ${divisor}`}>Qnt.<br />Contratual<br />(m)</th>
                  <th className="pb-1 px-1.5 font-medium text-right leading-tight">Realizado<br />(m)</th>
                  <th className="pb-1 px-1.5 font-medium text-right leading-tight">Saldo<br />(m)</th>
                  <th className="pb-1 pl-2 font-medium text-right leading-tight">%<br />Executado</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => {
                  const cUn = contratualUn.get(l.chave);
                  const cM = contratualM.get(l.chave);
                  return (
                    <tr key={l.chave} className="border-b border-border/40">
                      <td className="py-1.5 pr-2 text-foreground">{l.exibicao}</td>
                      <td className="py-1.5 px-1.5 text-right tabular-nums text-muted-foreground">{cUn == null ? '—' : fmtUn(cUn)}</td>
                      <td className="py-1.5 px-1.5 text-right tabular-nums">{fmtUn(l.realizado)}</td>
                      <td className="py-1.5 px-1.5 text-right tabular-nums">{saldoUn(cUn, l.realizado)}</td>
                      <td className={`py-1.5 px-1.5 text-right tabular-nums text-muted-foreground ${divisor}`}>{cM == null ? '—' : fmtM(cM)}</td>
                      <td className="py-1.5 px-1.5 text-right tabular-nums">{fmtM(l.realizadoM ?? 0)}</td>
                      <td className="py-1.5 px-1.5 text-right tabular-nums">{saldoM(cM, l.realizadoM ?? 0)}</td>
                      <td className="py-1.5 pl-2 text-right tabular-nums font-semibold">{fmtPct(pctLinha(cUn, l.realizado))}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-border font-semibold">
                  <td className="py-1.5 pr-2 text-foreground">Total</td>
                  <td className="py-1.5 px-1.5 text-right tabular-nums text-muted-foreground font-normal">{totContratualUn == null ? '—' : fmtUn(totContratualUn)}</td>
                  <td className="py-1.5 px-1.5 text-right tabular-nums">{fmtUn(totalRealUn)}</td>
                  <td className="py-1.5 px-1.5 text-right tabular-nums">{saldoUn(totContratualUn, totalRealUn)}</td>
                  <td className={`py-1.5 px-1.5 text-right tabular-nums text-muted-foreground font-normal ${divisor}`}>{totContratualM == null ? '—' : fmtM(totContratualM)}</td>
                  <td className="py-1.5 px-1.5 text-right tabular-nums">{fmtM(totalRealM)}</td>
                  <td className="py-1.5 px-1.5 text-right tabular-nums">{saldoM(totContratualM, totalRealM)}</td>
                  <td className="py-1.5 pl-2 text-right tabular-nums">{fmtPct(pctTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
};


const normalizarSubBacia = (s: string) =>
  s.toLowerCase().replace(/[\s.\-_,]/g, '');

const ocultarGenerica = (nome: string) => {
  const n = normalizarSubBacia(nome);
  return n === 'povss13' || n === 'povss14';
};

export const AvancoFisicoTab = ({ ordens }: Props) => {
  const avanco = useAvancoFisico(ordens);
  const { effectiveRole } = useAuth();
  const { porChave, salvar } = useQuantitativosContratuais();
  const [modalAberto, setModalAberto] = useState(false);
  const podeEditar = effectiveRole === 'admin' || effectiveRole === 'sala_tecnica';

  const subBaciasMap = new Map<string, string>();
  [...avanco.rede, ...avanco.ramais, ...avanco.linhaRecalque].forEach((l) => {
    if (!subBaciasMap.has(l.chave)) subBaciasMap.set(l.chave, l.exibicao);
  });
  const subBacias = Array.from(subBaciasMap, ([chave, exibicao]) => ({ chave, exibicao }));
  // Sub-bacias exclusivas de Linha de Recalque (ex.: Emissário) nunca aparecem
  // em Rede/Ramais — sua metragem pertence apenas à Linha de Recalque.
  const ramaisPorChave = new Map(avanco.ramais.map((l) => [l.chave, l]));
  const somenteLR = (l: LinhaAvanco) => {
    const r = ramaisPorChave.get(l.chave);
    return l.previsto === 0 && l.realizado === 0 && (r?.previsto ?? 0) === 0 && (r?.realizado ?? 0) === 0 && (r?.realizadoM ?? 0) === 0;
  };
  const chavesSomenteLR = new Set(avanco.rede.filter(somenteLR).map((l) => l.chave));
  // Rede e Ramais: ocultar apenas as referências genéricas POV. SS-13 / POV. SS-14
  const redeVisivel = avanco.rede.filter((l) => !ocultarGenerica(l.exibicao) && !chavesSomenteLR.has(l.chave));
  const ramaisVisivel = avanco.ramais.filter((l) => !ocultarGenerica(l.exibicao) && !chavesSomenteLR.has(l.chave));
  // Linha de Recalque: as genéricas SS-13 / SS-14 são válidas e devem aparecer
  const lrVisivel = avanco.linhaRecalque;
  const contratualRede = new Map(redeVisivel.map((l) => [l.chave, porChave.get(l.chave)?.redeM ?? null]));
  const contratualRamaisUn = new Map<string, number | null>(ramaisVisivel.map((l) => [l.chave, porChave.get(l.chave)?.ramaisUn ?? null]));
  const contratualRamaisM = new Map<string, number | null>(ramaisVisivel.map((l) => [l.chave, porChave.get(l.chave)?.ramaisM ?? null]));
  const contratualLR = new Map<string, number | null>(
    lrVisivel.map((l) => [l.chave, porChave.get(l.chave)?.lrM ?? null]),
  );



  if (avanco.loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="animate-spin text-muted-foreground" size={24} />
      </div>
    );
  }

  if (avanco.error) {
    return (
      <div className="text-center py-10 text-sm text-muted-foreground">
        Não foi possível carregar o avanço físico.
        <div className="mt-2">
          <Button size="sm" variant="outline" className="min-h-11" onClick={avanco.recarregar}>
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <CardResumo
          titulo="Avanço Físico — POV"
          redePrev={avanco.porClasse.POV.redePrevisto}
          redeReal={avanco.porClasse.POV.redeRealizado}
          redePct={avanco.porClasse.POV.redePct}
          ramaisPrev={avanco.porClasse.POV.ramaisPrevisto}
          ramaisReal={avanco.porClasse.POV.ramaisRealizado}
          ramaisPct={avanco.porClasse.POV.ramaisPct}
          lrPrev={avanco.porClasse.POV.lrPrevisto}
          lrReal={avanco.porClasse.POV.lrRealizado}
          lrPct={avanco.porClasse.POV.lrPct}
          accent="#0C447C"
        />
        <CardResumo
          titulo="Avanço Físico — Sede"
          redePrev={avanco.porClasse.SEDE.redePrevisto}
          redeReal={avanco.porClasse.SEDE.redeRealizado}
          redePct={avanco.porClasse.SEDE.redePct}
          ramaisPrev={avanco.porClasse.SEDE.ramaisPrevisto}
          ramaisReal={avanco.porClasse.SEDE.ramaisRealizado}
          ramaisPct={avanco.porClasse.SEDE.ramaisPct}
          lrPrev={avanco.porClasse.SEDE.lrPrevisto}
          lrReal={avanco.porClasse.SEDE.lrRealizado}
          lrPct={avanco.porClasse.SEDE.lrPct}
          accent="#185FA5"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <AvancoSecao
          titulo="Rede por sub-bacia"
          linhas={redeVisivel}
          unidade="m"
          formatar={fmtM}
          contratualPorChave={contratualRede}
          formatarContratual={fmtM}
          podeEditar={podeEditar}
          onEditar={() => setModalAberto(true)}
          saldoOperacional
        />

        <RamaisSecao
          linhas={ramaisVisivel}
          contratualUn={contratualRamaisUn}
          contratualM={contratualRamaisM}
          podeEditar={podeEditar}
          onEditar={() => setModalAberto(true)}
        />

        <AvancoSecao
          titulo="Linha de Recalque por sub-bacia"
          linhas={lrVisivel}
          unidade="m"
          formatar={fmtM}
          contratualPorChave={contratualLR}
          formatarContratual={fmtM}
          podeEditar={podeEditar}
          onEditar={() => setModalAberto(true)}
          saldoOperacional
        />

      </div>


      <QuantidadesContratuaisModal
        open={modalAberto}
        onOpenChange={setModalAberto}
        subBacias={subBacias}
        porChave={porChave}
        salvar={salvar}
      />
    </div>
  );
};
