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

/** Icon tile tint per category icon (govfix2 accents: aqua, leaf, coral, amber, slate). Icons are ≥3:1 on their tile. */
export const TINT: Record<string, string> = {
  waves: 'bg-[#dcefee] text-[#0a5d63]',
  droplet: 'bg-[#dcefee] text-[#0a5d63]',
  'droplet-off': 'bg-[#dcefee] text-[#0a5d63]',
  'trash-2': 'bg-[#e3efdf] text-[#2f5d33]',
  construction: 'bg-[#f8dfd8] text-[#9a3a26]',
  'lightbulb-off': 'bg-[#faebc4] text-[#755f2e]',
  dog: 'bg-[#e9eeeb] text-[#3d5550]',
  'circle-help': 'bg-mint text-nmc',
};

export function CategoryIcon({ name, ...props }: { name: string | null | undefined } & LucideProps) {
  const Icon = ICONS[name ?? ''] ?? CircleHelp;
  return <Icon aria-hidden {...props} />;
}
