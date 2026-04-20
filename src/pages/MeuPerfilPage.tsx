import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Save, Camera, KeyRound, User as UserIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ROLE_LABELS } from '@/types/sanegest';

const MeuPerfilPage = () => {
  const { user, supabaseUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [changingPwd, setChangingPwd] = useState(false);

  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarSignedUrl, setAvatarSignedUrl] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [newPassword2, setNewPassword2] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('display_name, email, phone, avatar_url')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) {
        setDisplayName(data.display_name ?? '');
        setEmail(data.email ?? supabaseUser?.email ?? '');
        setPhone((data as any).phone ?? '');
        setAvatarUrl((data as any).avatar_url ?? null);
      }
      setLoading(false);
    };
    load();
  }, [user, supabaseUser]);

  // Sign avatar URL when present
  useEffect(() => {
    if (!avatarUrl) {
      setAvatarSignedUrl(null);
      return;
    }
    supabase.storage.from('avatars').createSignedUrl(avatarUrl, 60 * 60).then(({ data }) => {
      setAvatarSignedUrl(data?.signedUrl ?? null);
    });
  }, [avatarUrl]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: displayName.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
      } as any)
      .eq('user_id', user.id);
    if (error) {
      toast.error('Erro ao salvar: ' + error.message);
    } else {
      toast.success('Perfil atualizado!');
    }
    setSaving(false);
  };

  const handleAvatarUpload = async (file: File) => {
    if (!user) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Imagem muito grande (máx 5 MB).');
      return;
    }
    setUploading(true);
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from('avatars')
      .upload(path, file, { cacheControl: '3600', upsert: false });
    if (upErr) {
      toast.error('Erro ao enviar imagem: ' + upErr.message);
      setUploading(false);
      return;
    }
    // Update profile.avatar_url with the storage path
    const { error: updErr } = await supabase
      .from('profiles')
      .update({ avatar_url: path } as any)
      .eq('user_id', user.id);
    if (updErr) {
      toast.error('Erro ao salvar avatar no perfil: ' + updErr.message);
    } else {
      setAvatarUrl(path);
      toast.success('Foto atualizada!');
    }
    setUploading(false);
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (newPassword !== newPassword2) {
      toast.error('As senhas não conferem.');
      return;
    }
    setChangingPwd(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast.error('Erro ao alterar senha: ' + error.message);
    } else {
      toast.success('Senha alterada com sucesso!');
      setNewPassword('');
      setNewPassword2('');
    }
    setChangingPwd(false);
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-muted-foreground" size={28} />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <UserIcon size={24} className="text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Meu Perfil</h1>
            <p className="text-sm text-muted-foreground">
              {user && ROLE_LABELS[user.role]}
            </p>
          </div>
        </div>

        {/* Avatar */}
        <div className="bg-card rounded-xl border border-border shadow-sm p-6 mb-6">
          <h2 className="text-base font-semibold text-foreground mb-4">Foto de perfil</h2>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-muted overflow-hidden flex items-center justify-center border border-border">
              {avatarSignedUrl ? (
                <img src={avatarSignedUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-bold text-muted-foreground">
                  {(displayName || email || '?')[0]?.toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleAvatarUpload(f);
                  e.target.value = '';
                }}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="animate-spin mr-2" size={14} />
                ) : (
                  <Camera size={14} className="mr-2" />
                )}
                {avatarUrl ? 'Alterar foto' : 'Enviar foto'}
              </Button>
              <p className="text-xs text-muted-foreground mt-1">JPG ou PNG, até 5 MB.</p>
            </div>
          </div>
        </div>

        {/* Dados pessoais */}
        <div className="bg-card rounded-xl border border-border shadow-sm p-6 mb-6 space-y-4">
          <h2 className="text-base font-semibold text-foreground">Dados pessoais</h2>
          <div>
            <Label htmlFor="display_name">Nome completo</Label>
            <Input
              id="display_name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Seu nome"
            />
          </div>
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Editar este campo só atualiza o perfil. Para alterar o e-mail de login, contate o admin.
            </p>
          </div>
          <div>
            <Label htmlFor="phone">Telefone</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(82) 9 9999-9999"
            />
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="animate-spin mr-2" size={14} /> : <Save size={14} className="mr-2" />}
            Salvar alterações
          </Button>
        </div>

        {/* Senha */}
        <div className="bg-card rounded-xl border border-border shadow-sm p-6 space-y-4">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <KeyRound size={16} /> Alterar senha
          </h2>
          <div>
            <Label htmlFor="newpwd">Nova senha</Label>
            <Input
              id="newpwd"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              minLength={6}
            />
          </div>
          <div>
            <Label htmlFor="newpwd2">Confirmar nova senha</Label>
            <Input
              id="newpwd2"
              type="password"
              value={newPassword2}
              onChange={(e) => setNewPassword2(e.target.value)}
              placeholder="••••••••"
              minLength={6}
            />
          </div>
          <Button
            onClick={handleChangePassword}
            disabled={changingPwd || !newPassword || !newPassword2}
            variant="secondary"
          >
            {changingPwd ? <Loader2 className="animate-spin mr-2" size={14} /> : <KeyRound size={14} className="mr-2" />}
            Alterar senha
          </Button>
        </div>
      </div>
    </AppLayout>
  );
};

export default MeuPerfilPage;
