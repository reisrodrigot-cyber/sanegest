import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { OrdemServico } from '@/types/sanegest';
import { AlertTriangle, Loader2, UserMinus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
  open: boolean;
  onClose: () => void;
  selectedOS: OrdemServico[];
  onDone: () => void;
}

export function DesatribuirModal({ open, onClose, selectedOS, onDone }: Props) {
  const { user, actingUserId } = useAuth();
  const [working, setWorking] = useState(false);

  // Só faz sentido desatribuir OS que estão liberadas
  const alvo = selectedOS.filter(os => os.liberado);
  const ignoradas = selectedOS.filter(os => !os.liberado);
  const isBatch = selectedOS.length > 1;
  const single = alvo[0];

  const handleConfirm = async () => {
    if (alvo.length === 0) {
      toast.error('Nenhuma N.S. liberada para desatribuir.');
      return;
    }
    setWorking(true);
    const ids = alvo.map(o => o.id);

    // 1) Retira encarregado e marca como não liberada (mantém status atual para preservar fase)
    const { error } = await supabase
      .from('ordens_servico')
      .update({ liberado: false, liberado_para: null })
      .in('id', ids);

    if (error) {
      setWorking(false);
      toast.error(`Erro ao desatribuir: ${error.message}`);
      return;
    }

    // 2) Registra no histórico (sem alterar status)
    const historico = alvo.map(os => ({
      os_id: os.id,
      status_anterior: os.status,
      status_novo: os.status,
      user_id: actingUserId ?? user?.id ?? null,
      observacao: `Desatribuída de ${os.liberado_para || '—'} e devolvida para "Não liberadas".`,
    }));
    await supabase.from('os_status_historico').insert(historico);

    setWorking(false);
    toast.success(
      alvo.length === 1
        ? `N.S. ${alvo[0].trecho} desatribuída.`
        : `${alvo.length} N.S. desatribuídas.`
    );
    onDone();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !working && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-destructive/15 text-destructive">
              <UserMinus size={16} />
            </span>
            <DialogTitle>
              {isBatch ? 'Desatribuir N.S. em lote' : 'Desatribuir N.S.?'}
            </DialogTitle>
          </div>
          {!isBatch && single && (
            <DialogDescription className="pt-2">
              A N.S. <strong className="text-foreground">{single.trecho}</strong> será retirada de{' '}
              <strong className="text-foreground">{single.liberado_para || '—'}</strong> e voltará para
              “Não liberada”. Os registros de produção e o histórico serão preservados.
            </DialogDescription>
          )}
        </DialogHeader>

        {isBatch && (
          <div className="space-y-4 text-sm">
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-1.5">
              <div className="flex justify-between"><span>Total selecionadas:</span><strong>{selectedOS.length}</strong></div>
              <div className="flex justify-between text-destructive">
                <span className="flex items-center gap-1"><UserMinus size={14}/> Serão desatribuídas:</span>
                <strong>{alvo.length}</strong>
              </div>
              {ignoradas.length > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span className="flex items-center gap-1"><AlertTriangle size={14}/> Já estão “Não liberadas” (ignoradas):</span>
                  <strong>{ignoradas.length}</strong>
                </div>
              )}
            </div>

            {alvo.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground">Ver N.S. que serão desatribuídas</summary>
                <ul className="mt-2 max-h-40 overflow-auto space-y-0.5">
                  {alvo.map(o => (
                    <li key={o.id}>• {o.trecho} — atual: <span className="font-medium">{o.liberado_para || '—'}</span></li>
                  ))}
                </ul>
              </details>
            )}

            <p className="text-xs text-muted-foreground">
              Os registros de produção, metragem executada, ligações, observações e histórico serão preservados.
              As N.S. voltarão à aba <strong>Não liberadas</strong> e poderão ser liberadas novamente depois.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={working}>Cancelar</Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={working || alvo.length === 0}>
            {working && <Loader2 size={16} className="animate-spin mr-1" />}
            Confirmar desatribuição
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
