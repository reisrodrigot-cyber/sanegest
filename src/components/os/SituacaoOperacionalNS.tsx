import { STATUS_ORDER, STATUS_META, resolveDisplayStatus, type OSStatus, type OSDisplayStatus } from '@/lib/osStatus';

interface Props {
  /** N.S. liberada para o encarregado */
  liberado?: boolean | null;
  /** existe produção ativa registrada */
  temProducao?: boolean | null;
  /** existe registro ativo com pv_final_assentado = true */
  pvFinalAssentado?: boolean | null;
  /** status técnico legado, usado apenas como fallback visual seguro */
  statusLegado?: OSStatus | string | null;
}

/** Descrições oficiais da situação operacional (apresentação). */
const DESCRICAO: Record<OSDisplayStatus, string> = {
  CINZA: 'N.S. ainda não liberada para execução.',
  VERMELHO: 'Liberada, mas ainda sem produção registrada.',
  AMARELO: 'Possui produção registrada, mas o PV final ainda não foi assentado.',
  VERDE: 'PV final confirmado em campo; pronto para topografia.',
  AZUL: 'Sem ocorrências no momento.',
};

/**
 * Visualização operacional derivada da N.S. — não grava nada.
 * Consome exclusivamente o módulo central `@/lib/osStatus`.
 */
export const SituacaoOperacionalNS = ({ liberado, temProducao, pvFinalAssentado, statusLegado }: Props) => {
  const atual = resolveDisplayStatus({ liberado, temProducao, pvFinalAssentado, statusLegado });

  return (
    <section
      className="bg-card rounded-xl border border-border shadow-sm p-4 mb-6"
      aria-label="Situação operacional da N.S."
    >
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-foreground">Situação operacional da N.S.</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Classificação automática, derivada da liberação, da produção registrada, do PV final assentado e da topografia.
        </p>
      </div>

      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" role="list">
        {STATUS_ORDER.map((k) => {
          const m = STATUS_META[k];
          const ativo = k === atual;
          return (
            <li
              key={k}
              aria-current={ativo ? 'true' : undefined}
              className={`flex items-start gap-2 rounded-lg border p-3 transition-colors ${
                ativo ? `${m.ringClass} ring-2 border-transparent bg-muted/60` : 'border-border opacity-70'
              }`}
            >
              <span className={`w-3 h-3 rounded-full mt-1 shrink-0 ${m.bgClass}`} aria-hidden="true" />
              <div className="min-w-0">
                <p className={`text-sm font-medium ${ativo ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {m.label}
                  {ativo && <span className="ml-2 text-[11px] font-semibold uppercase tracking-wide text-foreground/70">situação atual</span>}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{DESCRICAO[k]}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
