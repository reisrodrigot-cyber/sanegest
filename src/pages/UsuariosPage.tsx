import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole, ROLE_LABELS } from '@/types/sanegest';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect } from 'react';
import { Loader2, Shield, Users, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Navigate } from 'react-router-dom';

interface UserRow {
  user_id: string;
  email: string | null;
  display_name: string | null;
  apelido: string | null;
  role: UserRole | null;
}

const ALL_ROLES: UserRole[] = ['admin', 'sala_tecnica', 'encarregado', 'almoxarifado', 'topografo', 'gerencia'];

const UsuariosPage = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [apelidoDraft, setApelidoDraft] = useState<Record<string, string>>({});
  const [savingApelido, setSavingApelido] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, email, display_name, apelido')
      .order('created_at', { ascending: true });

    const { data: roles } = await supabase
      .from('user_roles')
      .select('user_id, role');

    const roleMap: Record<string, UserRole> = {};
    roles?.forEach((r: any) => { roleMap[r.user_id] = r.role as UserRole; });

    const merged: UserRow[] = (profiles ?? []).map((p: any) => ({
      user_id: p.user_id,
      email: p.email,
      display_name: p.display_name,
      apelido: p.apelido ?? null,
      role: roleMap[p.user_id] ?? null,
    }));

    setUsers(merged);
    const draft: Record<string, string> = {};
    merged.forEach(u => { draft[u.user_id] = u.apelido ?? ''; });
    setApelidoDraft(draft);
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleRoleChange = async (userId: string, newRole: string) => {
    setSaving(userId);
    const role = newRole as UserRole;
    const existing = users.find(u => u.user_id === userId);

    if (existing?.role) {
      const { error } = await supabase
        .from('user_roles')
        .update({ role } as any)
        .eq('user_id', userId);
      if (error) {
        toast.error('Erro ao atualizar perfil: ' + error.message);
        setSaving(null);
        return;
      }
    } else {
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role } as any);
      if (error) {
        toast.error('Erro ao atribuir perfil: ' + error.message);
        setSaving(null);
        return;
      }
    }

    toast.success('Perfil atualizado!');
    setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, role } : u));
    setSaving(null);
  };

  const handleRemoveRole = async (userId: string) => {
    if (!confirm('Remover perfil deste usuário? Ele perderá acesso ao sistema.')) return;
    setSaving(userId);
    const { error } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId);
    if (error) {
      toast.error('Erro ao remover perfil: ' + error.message);
    } else {
      toast.success('Perfil removido.');
      setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, role: null } : u));
    }
    setSaving(null);
  };

  const handleDeleteUser = async (userId: string, label: string) => {
    if (!confirm(`Excluir DEFINITIVAMENTE o usuário "${label}"? Esta ação remove a conta e todos os dados vinculados (registros, ligações, topografia).`)) return;
    setDeleting(userId);
    const { data, error } = await supabase.functions.invoke('delete-user', {
      body: { user_id: userId },
    });
    if (error) {
      toast.error('Erro: ' + error.message);
    } else if ((data as any)?.error) {
      toast.error((data as any).error);
    } else {
      toast.success('Usuário excluído.');
      setUsers(prev => prev.filter(u => u.user_id !== userId));
    }
    setDeleting(null);
  };

  const handleSaveApelido = async (userId: string) => {
    const val = (apelidoDraft[userId] ?? '').trim();
    setSavingApelido(userId);
    const { error } = await supabase
      .from('profiles')
      .update({ apelido: val || null } as any)
      .eq('user_id', userId);
    if (error) {
      toast.error('Erro ao salvar apelido: ' + error.message);
    } else {
      toast.success('Apelido atualizado!');
      setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, apelido: val || null } : u));
    }
    setSavingApelido(null);
  };

  if (user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <AppLayout>
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Users size={24} className="text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gestão de Usuários</h1>
          <p className="text-sm text-muted-foreground">Atribua ou altere perfis dos usuários cadastrados</p>
        </div>
        <button
          onClick={handleExportHandoff}
          disabled={exporting}
          title="Exportação temporária de referência para recriação corporativa"
          className="ml-auto inline-flex items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
        >
          {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          Baixar dados técnicos para entrega
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-muted-foreground" size={24} />
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Usuário</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Apelido</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">E-mail</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Perfil Atual</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.user_id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-xs font-bold text-primary">
                            {(u.apelido || u.display_name || u.email || '?')[0].toUpperCase()}
                          </span>
                        </div>
                        <span className="font-medium text-foreground">{u.display_name || '—'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <input
                          value={apelidoDraft[u.user_id] ?? ''}
                          onChange={e => setApelidoDraft(prev => ({ ...prev, [u.user_id]: e.target.value }))}
                          placeholder="—"
                          className="text-xs border border-input rounded px-2 py-1.5 bg-background text-foreground w-32"
                        />
                        {(apelidoDraft[u.user_id] ?? '') !== (u.apelido ?? '') && (
                          <button
                            onClick={() => handleSaveApelido(u.user_id)}
                            disabled={savingApelido === u.user_id}
                            className="text-xs text-primary hover:underline disabled:opacity-50"
                          >
                            {savingApelido === u.user_id ? <Loader2 size={11} className="animate-spin" /> : 'Salvar'}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email || '—'}</td>
                    <td className="px-4 py-3">
                      {u.role ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                          <Shield size={12} />
                          {ROLE_LABELS[u.role]}
                        </span>
                      ) : (
                        <span className="text-xs text-amber-600 font-medium">Aguardando perfil</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <select
                          value={u.role ?? ''}
                          onChange={e => {
                            if (e.target.value) handleRoleChange(u.user_id, e.target.value);
                          }}
                          disabled={saving === u.user_id || u.user_id === user?.id}
                          className="text-xs border border-input rounded px-2 py-1.5 bg-background text-foreground disabled:opacity-50"
                        >
                          <option value="">— Selecione —</option>
                          {ALL_ROLES.map(r => (
                            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                          ))}
                        </select>
                        {u.role && u.user_id !== user?.id && (
                          <button
                            onClick={() => handleRemoveRole(u.user_id)}
                            disabled={saving === u.user_id}
                            className="text-xs text-muted-foreground hover:text-foreground hover:underline disabled:opacity-50"
                          >
                            Remover perfil
                          </button>
                        )}
                        {u.user_id !== user?.id && (
                          <button
                            onClick={() => handleDeleteUser(u.user_id, u.display_name || u.email || u.user_id)}
                            disabled={deleting === u.user_id}
                            className="text-xs text-destructive hover:underline disabled:opacity-50 inline-flex items-center gap-1"
                          >
                            {deleting === u.user_id ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                            Excluir conta
                          </button>
                        )}
                        {saving === u.user_id && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {users.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              Nenhum usuário cadastrado.
            </div>
          )}
        </div>
      )}
    </AppLayout>
  );
};

export default UsuariosPage;
