import { AppLayout } from '@/components/AppLayout';
import { FileSpreadsheet, Download, Upload, AlertCircle } from 'lucide-react';
import { useState } from 'react';

const ImportarPage = () => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string[] | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      // Mock preview
      setPreview(['TR-1.1', 'TR-1.2', 'TR-1.3', 'TR-1.4', 'TR-1.5', 'TR-1.6', 'TR-1.7', 'TR-1.8', 'TR-1.9', 'TR-1.10']);
    }
  };

  return (
    <AppLayout>
      <h1 className="text-2xl font-bold text-foreground mb-1">Importar Planilhão</h1>
      <p className="text-sm text-muted-foreground mb-6">Importe os dados da planilha Excel para criar as OS automaticamente</p>

      <div className="bg-card rounded-xl border border-border shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <AlertCircle size={20} className="text-status-yellow" />
          Como importar o Planilhão
        </h2>
        <ul className="space-y-2 text-sm text-foreground mb-6">
          <li className="flex items-start gap-2">
            <span className="font-semibold text-primary min-w-[20px]">1.</span>
            O arquivo deve ser <strong>.xlsx</strong> com uma aba chamada <strong>"PLANILHÃO"</strong>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-semibold text-primary min-w-[20px]">2.</span>
            O cabeçalho deve estar na <strong>linha 18</strong> e os dados a partir da <strong>linha 22</strong>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-semibold text-primary min-w-[20px]">3.</span>
            Linhas válidas são identificadas pela coluna B começando com <strong>"TR-"</strong>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-semibold text-primary min-w-[20px]">4.</span>
            OS já existentes com o mesmo código serão <strong>atualizadas</strong>, não duplicadas
          </li>
        </ul>

        <div className="flex flex-wrap gap-3">
          <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm cursor-pointer hover:opacity-90 transition-opacity">
            <Upload size={16} />
            Selecionar Arquivo
            <input type="file" accept=".xlsx" onChange={handleFileChange} className="hidden" />
          </label>
          <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-foreground font-medium text-sm hover:bg-muted transition-colors">
            <Download size={16} />
            Baixar Modelo
          </button>
        </div>

        {file && (
          <p className="mt-3 text-sm text-muted-foreground">
            Arquivo selecionado: <strong className="text-foreground">{file.name}</strong>
          </p>
        )}
      </div>

      {preview && (
        <div className="bg-card rounded-xl border border-border shadow-sm p-6">
          <h2 className="text-lg font-semibold text-foreground mb-2">Prévia da Importação</h2>
          <p className="text-sm text-muted-foreground mb-4">
            <strong className="text-foreground">{preview.length}</strong> OS identificadas
          </p>
          <div className="flex flex-wrap gap-2 mb-6">
            {preview.map(t => (
              <span key={t} className="px-3 py-1.5 rounded-lg bg-muted text-sm font-medium text-foreground">{t}</span>
            ))}
          </div>
          <button className="px-6 py-2.5 rounded-lg bg-status-green text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity">
            Confirmar Importação
          </button>
        </div>
      )}
    </AppLayout>
  );
};

export default ImportarPage;
