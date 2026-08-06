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
    items: { chave: string; exibicao: string; redeM: number | null; ramaisUn: number | null }[],
  ) => Promise<{ error: unknown }>;
}

const parseNum = (v: string): number | null => {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export function QuantidadesContratuaisModal({ open, onOpenChange, subBacias, porChave, salvar }: Props) {
  const [valores, setValores] = useState<Record<string, { rede: string; ramais: string }>>({});
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;
    const init: Record<string, { rede: string; ramais: string }> = {};
    subBacias.forEach((s) => {
      const q = porChave.get(s.chave);
      init[s.chave] = {
        rede: q?.redeM != null ? String(q.redeM).replace('.', ',') : '',
        ramais: q?.ramaisUn != null ? String(q.ramaisUn) : '',
      };
    });
    setValores(init);
  }, [open, subBacias, porChave]);

  const handleSalvar = async () => {
    setSalvando(true);
    const items = subBacias.map((s) => ({
      chave: s.chave,
      exibicao: s.exibicao,
      redeM: parseNum(valores[s.chave]?.rede ?? ''),
      ramaisUn: parseNum(valores[s.chave]?.ramais ?? ''),
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar quantidades contratuais</DialogTitle>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-auto -mx-2 px-2">
          <div className="hidden sm:grid grid-cols-[1fr_140px_120px] gap-2 pb-1 text-xs text-muted-foreground font-medium">
            <span>Sub-bacia</span>
            <span className="text-right">Rede (m)</span>
            <span className="text-right">Ramais (un.)</span>
          </div>
          <ul className="flex flex-col gap-2">
            {subBacias.map((s) => (
              <li key={s.chave} className="grid grid-cols-1 sm:grid-cols-[1fr_140px_120px] gap-2 items-center border-b border-border/40 pb-2 sm:pb-1 sm:border-0">
                <span className="text-sm text-foreground">{s.exibicao}</span>
                <Input
                  inputMode="decimal"
                  placeholder="Rede (m)"
                  className="h-9 text-right tabular-nums"
                  value={valores[s.chave]?.rede ?? ''}
                  onChange={(e) =>
                    setValores((v) => ({ ...v, [s.chave]: { rede: e.target.value, ramais: v[s.chave]?.ramais ?? '' } }))
                  }
                />
                <Input
                  inputMode="numeric"
                  placeholder="Ramais (un.)"
                  className="h-9 text-right tabular-nums"
                  value={valores[s.chave]?.ramais ?? ''}
                  onChange={(e) =>
                    setValores((v) => ({ ...v, [s.chave]: { rede: v[s.chave]?.rede ?? '', ramais: e.target.value } }))
                  }
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
