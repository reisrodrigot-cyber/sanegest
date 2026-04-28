import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  layerKey: 'rede' | 'ligacoes';
  title: string;
  initialCor: string;
  initialOpacidade: number;
  onSaved: () => void;
}

export const AsBuiltConfigModal = ({
  open, onOpenChange, layerKey, title, initialCor, initialOpacidade, onSaved,
}: Props) => {
  const { supabaseUser } = useAuth();
  const [cor, setCor] = useState(initialCor);
  const [opacidade, setOpacidade] = useState(initialOpacidade * 100);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setCor(initialCor);
      setOpacidade(initialOpacidade * 100);
    }
  }, [open, initialCor, initialOpacidade]);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('mapa_asbuilt_config')
        .update({
          cor,
          opacidade: opacidade / 100,
          updated_by: supabaseUser?.id,
          updated_at: new Date().toISOString(),
        })
        .eq('layer_key', layerKey);
      if (error) throw error;
      toast.success('Camada atualizada');
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar {title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="ab-cor">Cor da camada</Label>
            <div className="flex items-center gap-3 mt-1">
              <input
                id="ab-cor"
                type="color"
                value={cor}
                onChange={(e) => setCor(e.target.value)}
                className="h-10 w-16 rounded border border-input cursor-pointer bg-transparent"
              />
              <span className="text-sm font-mono text-muted-foreground">{cor}</span>
            </div>
          </div>
          <div>
            <Label>Opacidade: {Math.round(opacidade)}%</Label>
            <Slider
              value={[opacidade]}
              onValueChange={(v) => setOpacidade(v[0])}
              min={30}
              max={100}
              step={5}
              className="mt-2"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
