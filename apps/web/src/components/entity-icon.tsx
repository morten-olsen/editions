import {
  Newspaper,
  Globe,
  Code,
  Cpu,
  Rocket,
  FlaskConical,
  Microscope,
  BookOpen,
  GraduationCap,
  Briefcase,
  TrendingUp,
  DollarSign,
  BarChart3,
  Heart,
  Shield,
  Scale,
  Landmark,
  Building2,
  Users,
  MessageCircle,
  Pen,
  Camera,
  Film,
  Music,
  Palette,
  Gamepad2,
  Trophy,
  Dumbbell,
  Leaf,
  Sun,
  Cloud,
  Plane,
  Car,
  Utensils,
  Coffee,
  ShoppingBag,
  Hammer,
  Wrench,
  Zap,
  Star,
  Flame,
  Target,
  Compass,
  Map,
  Mountain,
  Waves,
  Dog,
  Lightbulb,
} from "lucide-react";

import type { LucideIcon } from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  Newspaper,
  Globe,
  Code,
  Cpu,
  Rocket,
  FlaskConical,
  Microscope,
  BookOpen,
  GraduationCap,
  Briefcase,
  TrendingUp,
  DollarSign,
  BarChart3,
  Heart,
  Shield,
  Scale,
  Landmark,
  Building2,
  Users,
  MessageCircle,
  Pen,
  Camera,
  Film,
  Music,
  Palette,
  Gamepad2,
  Trophy,
  Dumbbell,
  Leaf,
  Sun,
  Cloud,
  Plane,
  Car,
  Utensils,
  Coffee,
  ShoppingBag,
  Hammer,
  Wrench,
  Zap,
  Star,
  Flame,
  Target,
  Compass,
  Map,
  Mountain,
  Waves,
  Dog,
  Lightbulb,
};

type EntityIconProps = {
  icon: string | null;
  size?: number;
  className?: string;
};

const EntityIcon = ({ icon, size = 16, className }: EntityIconProps): React.ReactElement | null => {
  if (!icon) return null;
  const IconComponent = iconMap[icon];
  if (!IconComponent) return null;
  return <IconComponent size={size} className={className} />;
};

const iconNames = Object.keys(iconMap);

export type { EntityIconProps };
export { EntityIcon, iconMap, iconNames };
