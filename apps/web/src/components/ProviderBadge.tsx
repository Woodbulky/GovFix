import { Camera, Cloud, Cpu, type LucideIcon, Type, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/** ai_suggestions.provider, plus `human` for staff decisions. */
export type Provider = 'llm' | 'local' | 'keyword' | 'vision' | 'human';

const ICON: Record<Provider, LucideIcon> = { llm: Cloud, local: Cpu, keyword: Type, vision: Camera, human: User };

export function ProviderBadge({ provider }: { provider: Provider | string }) {
  const { t } = useTranslation();
  const Icon = ICON[provider as Provider] ?? Cpu;
  return (
    <span className="inline-flex items-center gap-1 rounded-sm border border-line px-1.5 py-0.5 text-sm text-ink-muted">
      <Icon aria-hidden size={14} />
      {t(`provider.${provider}`, { defaultValue: provider })}
    </span>
  );
}
