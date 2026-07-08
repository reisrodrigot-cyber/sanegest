import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Encarregado {
  user_id: string;
  display_name: string;
  email: string;
}

export function useEncarregados() {
  const [data, setData] = useState<Encarregado[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'encarregado');
      const ids = (roles || []).map((r: any) => r.user_id);
      if (ids.length === 0) { setData([]); setLoading(false); return; }
      const { data: profs } = await supabase
        .from('profiles')
        .select('user_id, display_name, email, apelido')
        .in('user_id', ids);
      setData(((profs || []) as any[])
        .map(p => ({ user_id: p.user_id, display_name: p.apelido || p.display_name || p.email, email: p.email }))
        .sort((a, b) => a.display_name.localeCompare(b.display_name)));
      setLoading(false);
    })();
  }, []);

  return { encarregados: data, loading };
}
