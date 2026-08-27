import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import type { QuantitativoContratual } from '@/hooks/useQuantitativosContratuais';

export interface SubBaciaRef {
  chave: string;
  exibicao: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  subBacias: SubBaciaRef[];
  porChave: Map<string, QuantitativoContratual>;
  salvar: (
    items: { chave: string; exibicao: string; redeM: number | null; ramaisUn: number | null; ramaisM: number | null; lrM: number | null }[],
  ) => Promise<{ error: unknown }>;
}

const parseNum = (v: string): number | null => {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : null;
};

type Campos = { rede: string; ramais: string; ramaisM: string; lr: string };
const vazio: Campos = { rede: '', ramais: '', ramaisM: '', lr: '' };

export function QuantidadesContratuaisModal({ open, onOpenChange, subBacias, porChave, salvar }: Props) {
  const [valores, setValores] = useState<Record<string, Campos>>({});
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;
    const init: Record<string, Campos> = {};
    subBacias.forEach((s) => {
      const q = porChave.get(s.chave);
      init[s.chave] = {
        rede: q?.redeM != null ? String(q.redeM).replace('.', ',') : '',
        ramais: q?.ramaisUn != null ? String(q.ramaisUn) : '',
        ramaisM: q?.ramaisM != null ? String(q.ramaisM).replace('.', ',') : '',
        lr: q?.lrM != null ? String(q.lrM).replace('.', ',') : '',
      };
    });
    setValores(init);
  }, [open, subBacias, porChave]);

  const set = (chave: string, campo: keyof Campos, v: string) =>
    setValores((prev) => ({ ...prev, [chave]: { ...(prev[chave] ?? vazio), [campo]: v } }));

  const handleSalvar = async () => {
    setSalvando(true);
    const items = subBacias.map((s) => ({
      chave: s.chave,
      exibicao: s.exibicao,
      redeM: parseNum(valores[s.chave]?.rede ?? ''),
      ramaisUn: parseNum(valores[s.chave]?.ramais ?? ''),
      ramaisM: parseNum(valores[s.chave]?.ramaisM ?? ''),
      lrM: parseNum(valores[s.chave]?.lr ?? ''),
    }));
    const { error } = await salvar(items);
    setSalvando(false);
    if (error) {
      toast({ title: 'Não foi possível salvar', description: 'Verifique suas permissões.', variant: 'destructive' });
      return;
    }
    toast({ title: 'Quantidades contratuais salvas' });
    onOpenChange(false);
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Editar quantidades contratuais</DialogTitle>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-auto -mx-2 px-2">
          <div className="hidden sm:grid grid-cols-[1fr_110px_100px_110px_130px] gap-2 pb-1 text-xs text-muted-foreground font-medium">
            <span>Sub-bacia</span>
            <span className="text-right">Rede (m)</span>
            <span className="text-right">Ramais (un.)</span>
            <span className="text-right">Ramais (m)</span>
            <span className="text-right">Linha de Recalque (m)</span>
          </div>
          <ul className="flex flex-col gap-2">
            {subBacias.map((s) => (
              <li key={s.chave} className="grid grid-cols-1 sm:grid-cols-[1fr_110px_100px_110px_130px] gap-2 items-center border-b border-border/40 pb-2 sm:pb-1 sm:border-0">
                <span className="text-sm text-foreground">{s.exibicao}</span>
                <Input
                  inputMode="decimal"
                  placeholder="Rede (m)"
                  className="h-9 text-right tabular-nums"
                  value={valores[s.chave]?.rede ?? ''}
                  onChange={(e) => set(s.chave, 'rede', e.target.value)}
                />
                <Input
                  inputMode="numeric"
                  placeholder="Ramais (un.)"
                  className="h-9 text-right tabular-nums"
                  value={valores[s.chave]?.ramais ?? ''}
                  onChange={(e) => set(s.chave, 'ramais', e.target.value)}
                />
                <Input
                  inputMode="decimal"
                  placeholder="Ramais (m)"
                  className="h-9 text-right tabular-nums"
                  value={valores[s.chave]?.ramaisM ?? ''}
                  onChange={(e) => set(s.chave, 'ramaisM', e.target.value)}
                />
                <Input
                  inputMode="decimal"
                  placeholder="L. Recalque (m)"
                  className="h-9 text-right tabular-nums"
                  value={valores[s.chave]?.lr ?? ''}
                  onChange={(e) => set(s.chave, 'lr', e.target.value)}
                />
              </li>
            ))}
          </ul>
        </div>


        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={handleSalvar} disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
