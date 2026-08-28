import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { pavElegivel } from '@/lib/pavimentacao';
import { useEncarregadosPav, useInvalidatePav } from '@/hooks/usePavimentacao';

interface OSLite {
  id: string;
  trecho: string;
  bacia: string;
  pav_previsto: string | null;
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
  const { data: encarregados = [] } = useEncarregadosPav();
  const invalidate = useInvalidatePav();
  const [userId, setUserId] = useState('');
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);

  const elegiveis = useMemo(() => selectedOS.filter((o) => pavElegivel(o.pav_previsto)), [selectedOS]);
  const inelegiveis = useMemo(() => selectedOS.filter((o) => !pavElegivel(o.pav_previsto)), [selectedOS]);

  const alvo = modo === 'liberar' ? elegiveis : selectedOS;

  const handleConfirm = async () => {
    if (modo === 'liberar' && !userId) {
      toast.error('Selecione o Encarregado de Pavimentação.');
      return;
    }
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
              _encarregado_user_id: userId,
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
    setUserId('');
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
              ? 'A liberação de Pavimentação é independente da liberação de Rede e não altera produção, PV final ou status técnico.'
              : 'A N.S. deixará de aparecer para o Encarregado de Pavimentação. Registros já lançados são preservados.'}
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
                {inelegiveis.length} N.S. ignorada(s): pavimento previsto sem Asfalto ou Paralelepípedo.
              </p>
            </div>
          )}

          {modo === 'liberar' && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Encarregado de Pavimentação</label>
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Selecione…" />
                </SelectTrigger>
                <SelectContent>
                  {encarregados.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground italic">
                      Nenhum usuário com este perfil
                    </div>
                  ) : (
                    encarregados.map((e) => (
                      <SelectItem key={e.user_id} value={e.user_id}>{e.nome}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
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
