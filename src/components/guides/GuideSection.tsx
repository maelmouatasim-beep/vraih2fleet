import { cn } from "@/lib/utils";

interface GuideSectionProps {
  id: string;
  className?: string;
  children: React.ReactNode;
}

const GuideSection = ({ id, className, children }: GuideSectionProps) => {
  return (
    <section id={id} className={cn("scroll-mt-24 mb-12", className)}>
      {children}
    </section>
  );
};

export default GuideSection;
