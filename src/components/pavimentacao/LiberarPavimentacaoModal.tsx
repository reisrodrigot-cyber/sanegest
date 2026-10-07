import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { pavElegivelOS } from '@/lib/pavimentacao';
import { useInvalidatePav } from '@/hooks/usePavimentacao';

interface OSLite {
  id: string;
  trecho: string;
  bacia: string;
  pav_previsto: string | null;
  pav_real?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  selectedOS: OSLite[];
  /** 'liberar' | 'revogar' */
  modo: 'liberar' | 'revogar';
  onDone?: () => void;
}

export const LiberarPavimentacaoModal = ({ open, onClose, selectedOS, modo, onDone }: Props) => {
  const invalidate = useInvalidatePav();
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);

  const elegiveis = useMemo(() => selectedOS.filter((o) => pavElegivelOS(o.pav_previsto, o.pav_real)), [selectedOS]);
  const inelegiveis = useMemo(() => selectedOS.filter((o) => !pavElegivelOS(o.pav_previsto, o.pav_real)), [selectedOS]);

  const alvo = modo === 'liberar' ? elegiveis : selectedOS;

  const handleConfirm = async () => {
    if (alvo.length === 0) {
      toast.error('Nenhuma N.S. elegível selecionada.');
      return;
    }
    setSaving(true);
    let ok = 0;
    let erro = 0;
    for (const os of alvo) {
      const { error } =
        modo === 'liberar'
          ? await supabase.rpc('liberar_pavimentacao', {
              _os_id: os.id,
              _motivo: motivo || null,
            })
          : await supabase.rpc('revogar_liberacao_pavimentacao', {
              _os_id: os.id,
              _motivo: motivo || null,
            });
      if (error) { erro++; console.error(error); } else ok++;
    }
    setSaving(false);
    invalidate();
    if (ok > 0) toast.success(`${ok} N.S. ${modo === 'liberar' ? 'liberada(s)' : 'com liberação retirada'} para Pavimentação.`);
    if (erro > 0) toast.error(`${erro} N.S. não puderam ser processadas.`);
    setMotivo('');
    onDone?.();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {modo === 'liberar' ? 'Liberar Pavimentação' : 'Retirar liberação de Pavimentação'}
          </DialogTitle>
          <DialogDescription>
            {modo === 'liberar'
              ? 'Liberar esta N.S. para todos os Encarregados de Pavimentação.'
              : 'Retirar esta N.S. de todos os Encarregados de Pavimentação. Registros já lançados são preservados.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-md border border-border bg-muted/40 p-2 max-h-40 overflow-auto">
            {alvo.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Nenhuma N.S. elegível.</p>
            ) : (
              alvo.map((o) => (
                <div key={o.id} className="text-xs text-foreground flex justify-between gap-2 py-0.5">
                  <span className="font-medium truncate">{o.trecho}</span>
                  <span className="text-muted-foreground truncate">{o.pav_previsto ?? '—'}</span>
                </div>
              ))
            )}
          </div>

          {modo === 'liberar' && inelegiveis.length > 0 && (
            <div className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2">
              <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-400">
                {inelegiveis.length} N.S. ignorada(s): sem Asfalto ou Paralelepípedo no pavimento previsto ou executado.
              </p>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Motivo (opcional)</label>
            <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} className="h-9 text-sm" />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleConfirm} disabled={saving || alvo.length === 0}>
            {saving && <Loader2 size={14} className="animate-spin mr-1" />}
            Confirmar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
