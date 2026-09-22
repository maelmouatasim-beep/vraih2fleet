import { Battery, Droplets, Leaf, Building2, Truck, Route, Calendar, Coins, Settings } from "lucide-react";

export interface GuideCategory {
  id: string;
  titleKey: string;
  descriptionKey: string;
  guides: GuideItem[];
}

export interface GuideItem {
  id: string;
  slug: string;
  titleKey: string;
  descriptionKey: string;
  readTimeKey: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  category: 'technology' | 'sector' | 'process';
}

export const technologyGuides: GuideItem[] = [
  {
    id: 'bev',
    slug: 'bev',
    titleKey: 'guides.bev.title',
    descriptionKey: 'guides.bev.description',
    readTimeKey: 'guides.bev.readTime',
    icon: Battery,
    href: '/guides/technology/bev',
    category: 'technology',
  },
  {
    id: 'fcev',
    slug: 'fcev',
    titleKey: 'guides.fcev.title',
    descriptionKey: 'guides.fcev.description',
    readTimeKey: 'guides.fcev.readTime',
    icon: Droplets,
    href: '/guides/technology/fcev',
    category: 'technology',
  },
  {
    id: 'biomethane',
    slug: 'biomethane',
    titleKey: 'guides.biomethane.title',
    descriptionKey: 'guides.biomethane.description',
    readTimeKey: 'guides.biomethane.readTime',
    icon: Leaf,
    href: '/guides/technology/biomethane',
    category: 'technology',
  },
];

export const sectorGuides: GuideItem[] = [
  {
    id: 'urban',
    slug: 'urban',
    titleKey: 'guides.urban.title',
    descriptionKey: 'guides.urban.description',
    readTimeKey: 'guides.urban.readTime',
    icon: Building2,
    href: '/guides/sectors/urban',
    category: 'sector',
  },
  {
    id: 'regional',
    slug: 'regional',
    titleKey: 'guides.regional.title',
    descriptionKey: 'guides.regional.description',
    readTimeKey: 'guides.regional.readTime',
    icon: Route,
    href: '/guides/sectors/regional',
    category: 'sector',
  },
  {
    id: 'longhaul',
    slug: 'long-haul',
    titleKey: 'guides.longhaul.title',
    descriptionKey: 'guides.longhaul.description',
    readTimeKey: 'guides.longhaul.readTime',
    icon: Truck,
    href: '/guides/sectors/long-haul',
    category: 'sector',
  },
];

export const processGuides: GuideItem[] = [
  {
    id: 'planning',
    slug: 'planning',
    titleKey: 'guides.planning.title',
    descriptionKey: 'guides.planning.description',
    readTimeKey: 'guides.planning.readTime',
    icon: Calendar,
    href: '/guides/planning',
    category: 'process',
  },
  {
    id: 'funding',
    slug: 'funding',
    titleKey: 'guides.funding.title',
    descriptionKey: 'guides.funding.description',
    readTimeKey: 'guides.funding.readTime',
    icon: Coins,
    href: '/guides/funding',
    category: 'process',
  },
  {
    id: 'operations',
    slug: 'operations',
    titleKey: 'guides.operations.title',
    descriptionKey: 'guides.operations.description',
    readTimeKey: 'guides.operations.readTime',
    icon: Settings,
    href: '/guides/operations',
    category: 'process',
  },
];

export const allGuides = [...technologyGuides, ...sectorGuides, ...processGuides];

export const guideCategories: GuideCategory[] = [
  {
    id: 'technology',
    titleKey: 'guides.categories.technology',
    descriptionKey: 'guides.categories.technologyDesc',
    guides: technologyGuides,
  },
  {
    id: 'sector',
    titleKey: 'guides.categories.sector',
    descriptionKey: 'guides.categories.sectorDesc',
    guides: sectorGuides,
  },
  {
    id: 'process',
    titleKey: 'guides.categories.process',
    descriptionKey: 'guides.categories.processDesc',
    guides: processGuides,
  },
];
