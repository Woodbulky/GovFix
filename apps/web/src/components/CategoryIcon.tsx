import {
  CircleHelp,
  Construction,
  Dog,
  Droplet,
  DropletOff,
  LightbulbOff,
  type LucideIcon,
  type LucideProps,
  Trash2,
  Waves,
} from 'lucide-react';

// categories.icon holds lucide names (config/workflow.yaml).
const ICONS: Record<string, LucideIcon> = {
  waves: Waves,
  droplet: Droplet,
  'droplet-off': DropletOff,
  'trash-2': Trash2,
  'lightbulb-off': LightbulbOff,
  dog: Dog,
  construction: Construction,
  'circle-help': CircleHelp,
};

export function CategoryIcon({ name, ...props }: { name: string | null | undefined } & LucideProps) {
  const Icon = ICONS[name ?? ''] ?? CircleHelp;
  return <Icon aria-hidden {...props} />;
}
