import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Camada {
  id: string;
  nome: string;
  descricao: string | null;
  cor: string;
  opacidade: number;
  storage_path?: string;
  arquivo_nome?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  camada?: Camada | null;
  onSaved: () => void;
}

export const CamadaModal = ({ open, onOpenChange, camada, onSaved }: Props) => {
  const { supabaseUser } = useAuth();
  const isEdit = !!camada;
  const [nome, setNome] = useState(camada?.nome ?? '');
  const [descricao, setDescricao] = useState(camada?.descricao ?? '');
  const [cor, setCor] = useState(camada?.cor ?? '#3b82f6');
  const [opacidade, setOpacidade] = useState((camada?.opacidade ?? 0.7) * 100);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  // Reset on open
  const handleOpenChange = (v: boolean) => {
    if (v) {
      setNome(camada?.nome ?? '');
      setDescricao(camada?.descricao ?? '');
      setCor(camada?.cor ?? '#3b82f6');
      setOpacidade((camada?.opacidade ?? 0.7) * 100);
      setArquivo(null);
    }
    onOpenChange(v);
  };

  const handleSubmit = async () => {
    if (!nome.trim()) {
      toast.error('Informe o nome da camada');
      return;
    }
    if (!isEdit && !arquivo) {
      toast.error('Selecione um arquivo KMZ');
      return;
    }
    if (arquivo && !arquivo.name.toLowerCase().endsWith('.kmz')) {
      toast.error('Apenas arquivos .kmz são aceitos');
      return;
    }
    if (arquivo && arquivo.size > 10 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo 10MB.');
      return;
    }

    setSaving(true);
    try {
      let storage_path = camada?.storage_path;
      let arquivo_nome = camada?.arquivo_nome;

      if (arquivo) {
        const path = `${supabaseUser?.id}/${Date.now()}-${arquivo.name}`;
        const { error: upErr } = await supabase.storage
          .from('mapa-kmz')
          .upload(path, arquivo, { contentType: 'application/vnd.google-earth.kmz' });
        if (upErr) throw upErr;
        storage_path = path;
        arquivo_nome = arquivo.name;
      }

      if (isEdit && camada) {
        const { error } = await supabase
          .from('mapa_camadas')
          .update({
            nome: nome.trim(),
            descricao: descricao.trim() || null,
            cor,
            opacidade: opacidade / 100,
            ...(arquivo && { storage_path, arquivo_nome }),
          })
          .eq('id', camada.id);
        if (error) throw error;
        toast.success('Camada atualizada');
      } else {
        const { error } = await supabase.from('mapa_camadas').insert({
          nome: nome.trim(),
          descricao: descricao.trim() || null,
          cor,
          opacidade: opacidade / 100,
          storage_path: storage_path!,
          arquivo_nome: arquivo_nome!,
          criado_por: supabaseUser?.id,
        });
        if (error) throw error;
        toast.success('Camada adicionada');
      }
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? 'Erro ao salvar camada');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar Camada' : 'Adicionar Camada KMZ'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {!isEdit && (
            <div>
              <Label htmlFor="kmz">Arquivo KMZ *</Label>
              <Input
                id="kmz"
                type="file"
                accept=".kmz,application/vnd.google-earth.kmz"
                onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground mt-1">Máximo 10MB.</p>
            </div>
          )}
          {isEdit && (
            <div>
              <Label>Substituir arquivo (opcional)</Label>
              <Input
                type="file"
                accept=".kmz,application/vnd.google-earth.kmz"
                onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Atual: {camada?.arquivo_nome}
              </p>
            </div>
          )}
          <div>
            <Label htmlFor="nome">Nome / Descrição *</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Faixa de Desapropriação"
            />
          </div>
          <div>
            <Label htmlFor="desc">Observação</Label>
            <Textarea
              id="desc"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={2}
              placeholder="Opcional"
            />
          </div>
          <div>
            <Label htmlFor="cor">Cor da camada</Label>
            <div className="flex items-center gap-3 mt-1">
              <input
                id="cor"
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
            {saving ? 'Salvando...' : isEdit ? 'Salvar' : 'Adicionar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
