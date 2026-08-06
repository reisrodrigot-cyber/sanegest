import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useEncarregados } from '@/hooks/useEncarregados';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { OrdemServico } from '@/types/sanegest';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  selectedOS: OrdemServico[];
  onDone: () => void;
}

export function LiberarLoteModal({ open, onClose, selectedOS, onDone }: Props) {
  const { encarregados, loading } = useEncarregados();
  const [encId, setEncId] = useState<string>('');
  const [working, setWorking] = useState(false);

  // Classify
  const bloqueadas = selectedOS.filter(os => os.status === 'VERDE');
  const reatribuir = selectedOS.filter(os => os.liberado && os.status !== 'VERDE');
  const liberaveis = selectedOS.filter(os => os.status !== 'VERDE');

  const enc = encarregados.find(e => e.user_id === encId);

  const handleConfirm = async () => {
    if (!enc) { toast.error('Selecione um encarregado.'); return; }
    if (liberaveis.length === 0) { toast.error('Nenhuma OS pode ser liberada.'); return; }
    setWorking(true);

    const name = enc.display_name;
    let ok = 0; const falhas: { trecho: string; erro: string }[] = [];

    // CINZA → vira VERMELHO ao liberar; demais mantêm status, só troca responsável
    const cinzas = liberaveis.filter(o => o.status === 'CINZA').map(o => o.id);
    const others = liberaveis.filter(o => o.status !== 'CINZA').map(o => o.id);

    if (cinzas.length) {
      const { error, count } = await supabase
        .from('ordens_servico')
        .update({ liberado: true, liberado_para: name, status: 'VERMELHO' }, { count: 'exact' })
        .in('id', cinzas);
      if (error) {
        cinzas.forEach(id => {
          const t = selectedOS.find(o => o.id === id)?.trecho || id;
          falhas.push({ trecho: t, erro: error.message });
        });
      } else ok += count ?? cinzas.length;
    }
    if (others.length) {
      const { error, count } = await supabase
        .from('ordens_servico')
        .update({ liberado: true, liberado_para: name }, { count: 'exact' })
        .in('id', others);
      if (error) {
        others.forEach(id => {
          const t = selectedOS.find(o => o.id === id)?.trecho || id;
          falhas.push({ trecho: t, erro: error.message });
        });
      } else ok += count ?? others.length;
    }

    setWorking(false);
    if (falhas.length) {
      toast.error(`${ok} liberadas, ${falhas.length} com erro.`);
      console.error('Falhas liberação lote:', falhas);
    } else {
      toast.success(`${ok} OS liberadas para ${name}.`);
    }
    onDone();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !working && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Liberar {selectedOS.length} OS em lote</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div>
            <label className="block font-medium mb-1.5">Encarregado</label>
            <Select value={encId} onValueChange={setEncId} disabled={loading || working}>
              <SelectTrigger><SelectValue placeholder={loading ? 'Carregando...' : 'Selecione o encarregado'} /></SelectTrigger>
              <SelectContent>
                {encarregados.map(e => (
                  <SelectItem key={e.user_id} value={e.user_id}>{e.display_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border border-border p-3 bg-muted/30 space-y-1.5">
            <div className="flex justify-between"><span>Total selecionadas:</span><strong>{selectedOS.length}</strong></div>
            <div className="flex justify-between text-status-green"><span>Serão liberadas:</span><strong>{liberaveis.length}</strong></div>
            {reatribuir.length > 0 && (
              <div className="flex justify-between text-amber-400">
                <span className="flex items-center gap-1"><AlertTriangle size={14}/> Já liberadas (serão reatribuídas):</span>
                <strong>{reatribuir.length}</strong>
              </div>
            )}
            {bloqueadas.length > 0 && (
              <div className="flex justify-between text-destructive">
                <span className="flex items-center gap-1"><AlertTriangle size={14}/> Concluídas (bloqueadas):</span>
                <strong>{bloqueadas.length}</strong>
              </div>
            )}
          </div>

          {reatribuir.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground">Ver OS que serão reatribuídas</summary>
              <ul className="mt-2 max-h-32 overflow-auto space-y-0.5">
                {reatribuir.map(o => (
                  <li key={o.id}>• {o.trecho} — atual: <span className="font-medium">{o.liberado_para}</span></li>
                ))}
              </ul>
            </details>
          )}
          {bloqueadas.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-destructive">Ver OS bloqueadas</summary>
              <ul className="mt-2 max-h-32 overflow-auto space-y-0.5">
                {bloqueadas.map(o => <li key={o.id}>• {o.trecho}</li>)}
              </ul>
            </details>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={working}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!encId || working || liberaveis.length === 0}>
            {working && <Loader2 size={16} className="animate-spin" />}
            Confirmar liberação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
