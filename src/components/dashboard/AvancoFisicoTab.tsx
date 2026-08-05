import { useMemo, useState } from 'react';
import { Loader2, Pencil, TrendingUp } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { permissions } from '@/lib/permissions';
import { useAvancoFisico } from '@/hooks/useAvancoFisico';
import type { LinhaAvanco, OrdemLike } from '@/lib/avancoFisico';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

const fmtM = (n: number) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtUn = (n: number) => n.toLocaleString('pt-BR');
const fmtPct = (p: number | null) => (p == null ? '—' : `${p.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`);

interface Props {
  ordens: OrdemLike[];
}

const CardResumo = ({
  titulo, redePrev, redeReal, redePct, ramaisPrev, ramaisReal, ramaisPct, accent,
}: {
  titulo: string; redePrev: number; redeReal: number; redePct: number | null;
  ramaisPrev: number; ramaisReal: number; ramaisPct: number | null; accent: string;
}) => (
  <div
    className="bg-card rounded-lg border border-border shadow-sm p-4 flex flex-col gap-2"
    style={{ borderTop: `3px solid ${accent}` }}
  >
    <div className="flex items-center justify-between text-muted-foreground">
      <span className="text-xs font-semibold uppercase tracking-wide">{titulo}</span>
      <TrendingUp size={16} style={{ color: accent }} />
    </div>
    <div className="grid grid-cols-2 gap-4">
      <div>
        <div className="text-3xl font-bold text-foreground leading-tight">{fmtPct(redePct)}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5">
          Rede: {fmtM(redeReal)} / {fmtM(redePrev)} m
        </div>
      </div>
      <div>
        <div className="text-3xl font-bold text-foreground leading-tight">{fmtPct(ramaisPct)}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5">
          Ramais: {fmtUn(ramaisReal)} / {fmtUn(ramaisPrev)} un.
        </div>
      </div>
    </div>
  </div>
);

const TabelaAvanco = ({
  titulo, linhas, unidade, totalLabel, formatar,
}: {
  titulo: string;
  linhas: LinhaAvanco[];
  unidade: string;
  totalLabel: string;
  formatar: (n: number) => string;
}) => {
  const previsto = linhas.reduce((s, l) => s + l.previsto, 0);
  const realizado = linhas.reduce((s, l) => s + l.realizado, 0);
  const pctTotal = previsto > 0 ? Math.round((realizado / previsto) * 1000) / 10 : null;
  return (
    <div className="bg-card rounded-lg border border-border shadow-sm p-3 flex flex-col min-h-0">
      <h3 className="text-sm font-semibold text-foreground mb-2">{titulo}</h3>
      <div className="overflow-auto max-h-[420px]">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-card">
            <tr className="text-left text-muted-foreground border-b border-border">
              <th className="pb-1 font-medium">Sub-bacia</th>
              <th className="pb-1 font-medium text-right">Previsto ({unidade})</th>
              <th className="pb-1 font-medium text-right">Realizado ({unidade})</th>
              <th className="pb-1 font-medium text-right">Saldo ({unidade})</th>
              <th className="pb-1 font-medium text-right">Percentual</th>
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 ? (
              <tr><td colSpan={5} className="text-center text-muted-foreground py-3">Sem dados.</td></tr>
            ) : linhas.map((l) => (
              <tr key={l.chave} className="border-b border-border/40">
                <td className="py-1 text-foreground">
                  {l.exibicao}
                  {!l.temReferencia && (
                    <span className="ml-1 text-[10px] text-muted-foreground">• sem referência</span>
                  )}
                </td>
                <td className="py-1 text-right tabular-nums">{formatar(l.previsto)}</td>
                <td className="py-1 text-right tabular-nums">{formatar(l.realizado)}</td>
                <td className="py-1 text-right tabular-nums">{formatar(l.saldo)}</td>
                <td className="py-1 text-right tabular-nums font-semibold">{fmtPct(l.pct)}</td>
              </tr>
            ))}
          </tbody>
          {linhas.length > 0 && (
            <tfoot>
              <tr className="border-t border-border font-semibold">
                <td className="py-1 text-foreground">{totalLabel}</td>
                <td className="py-1 text-right tabular-nums">{formatar(previsto)}</td>
                <td className="py-1 text-right tabular-nums">{formatar(realizado)}</td>
                <td className="py-1 text-right tabular-nums">{formatar(previsto - realizado)}</td>
                <td className="py-1 text-right tabular-nums">{fmtPct(pctTotal)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};

export const AvancoFisicoTab = ({ ordens }: Props) => {
  const { effectiveRole, user } = useAuth();
  const { toast } = useToast();
  const avanco = useAvancoFisico(ordens);
  const podeEditar =
    permissions.isAdmin(user?.role) || permissions.canEditOS(effectiveRole);

  const [aberto, setAberto] = useState(false);
  const [selecionada, setSelecionada] = useState<string>('');
  const [rede, setRede] = useState('0');
  const [ramais, setRamais] = useState('0');
  const [salvando, setSalvando] = useState(false);

  const subBacias = useMemo(
    () => avanco.rede.map((l) => l.exibicao),
    [avanco.rede],
  );

  const abrirEdicao = () => {
    const primeira = subBacias[0] ?? '';
    setSelecionada(primeira);
    const linha = avanco.rede.find((l) => l.exibicao === primeira);
    const linhaRamais = avanco.ramais.find((l) => l.exibicao === primeira);
    setRede(String(linha?.previsto ?? 0));
    setRamais(String(linhaRamais?.previsto ?? 0));
    setAberto(true);
  };

  const trocarSubBacia = (valor: string) => {
    setSelecionada(valor);
    const linha = avanco.rede.find((l) => l.exibicao === valor);
    const linhaRamais = avanco.ramais.find((l) => l.exibicao === valor);
    setRede(String(linha?.previsto ?? 0));
    setRamais(String(linhaRamais?.previsto ?? 0));
  };

  const salvar = async () => {
    const redeNum = Number(String(rede).replace(',', '.'));
    const ramaisNum = Number(String(ramais).replace(',', '.'));
    if (!selecionada.trim()) {
      toast({ title: 'Informe a sub-bacia', variant: 'destructive' });
      return;
    }
    if (!Number.isFinite(redeNum) || !Number.isFinite(ramaisNum) || redeNum < 0 || ramaisNum < 0) {
      toast({ title: 'Valores inválidos', description: 'Use apenas valores não negativos.', variant: 'destructive' });
      return;
    }
    setSalvando(true);
    const { error } = await avanco.salvarReferencia({
      bacia_exibicao: selecionada,
      rede_prevista_metros: redeNum,
      ramais_previstos_unidades: ramaisNum,
    });
    setSalvando(false);
    if (error) {
      toast({ title: 'Não foi possível salvar', description: error, variant: 'destructive' });
      return;
    }
    toast({ title: 'Referência atualizada' });
    setAberto(false);
  };

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
          <Button size="sm" variant="outline" onClick={avanco.recarregar}>Tentar novamente</Button>
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
          accent="#185FA5"
        />
      </div>

      {podeEditar && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={abrirEdicao}>
            <Pencil size={12} /> Editar referências
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <TabelaAvanco
          titulo="Rede por sub-bacia"
          linhas={avanco.rede}
          unidade="m"
          totalLabel="Total"
          formatar={fmtM}
        />
        <TabelaAvanco
          titulo="Ramais por sub-bacia"
          linhas={avanco.ramais}
          unidade="un."
          totalLabel="Total"
          formatar={(n) => fmtUn(Math.round(n))}
        />
      </div>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Referências físicas por sub-bacia</DialogTitle>
            <DialogDescription>
              Valores previstos manuais. Não alteram produção, ligações ou O.S.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Sub-bacia</Label>
              <select
                className="mt-1 w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={selecionada}
                onChange={(e) => trocarSubBacia(e.target.value)}
              >
                {subBacias.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Rede prevista (m)</Label>
              <Input
                className="mt-1"
                type="number"
                min={0}
                step="0.01"
                value={rede}
                onChange={(e) => setRede(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Ramais previstos (un.)</Label>
              <Input
                className="mt-1"
                type="number"
                min={0}
                step="1"
                value={ramais}
                onChange={(e) => setRamais(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAberto(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={salvando}>
              {salvando ? 'Salvando…' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
