import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import { 
  BookOpen, 
  Calculator, 
  Leaf, 
  Building2, 
  BarChart3, 
  Users, 
  Database, 
  Code,
  ChevronRight,
  Search,
  ExternalLink
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DocSection {
  id: string;
  icon: React.ElementType;
  title: string;
  description: string;
  articles: { title: string; href: string }[];
}

const docSections: DocSection[] = [
  {
    id: "getting-started",
    icon: BookOpen,
    title: "Getting Started",
    description: "Learn the basics of H2Fleet Planner and create your first project.",
    articles: [
      { title: "Quick Start Guide", href: "#quick-start" },
      { title: "Creating Your First Project", href: "#first-project" },
      { title: "Understanding the Dashboard", href: "#dashboard" },
      { title: "Navigation Overview", href: "#navigation" },
    ]
  },
  {
    id: "tco-calculation",
    icon: Calculator,
    title: "TCO Calculation",
    description: "Master the Total Cost of Ownership calculation engine.",
    articles: [
      { title: "TCO Methodology", href: "#tco-methodology" },
      { title: "CAPEX Components", href: "#capex" },
      { title: "OPEX Components", href: "#opex" },
      { title: "NPV & Payback Period", href: "#npv-payback" },
      { title: "Advanced Parameters", href: "#advanced-params" },
    ]
  },
  {
    id: "emissions",
    icon: Leaf,
    title: "Emissions & Sustainability",
    description: "Track CO₂ reductions and environmental impact.",
    articles: [
      { title: "Emission Factors", href: "#emission-factors" },
      { title: "Green vs Blue Hydrogen", href: "#h2-types" },
      { title: "Carbon Credits", href: "#carbon-credits" },
      { title: "ESG Reporting", href: "#esg" },
    ]
  },
  {
    id: "infrastructure",
    icon: Building2,
    title: "Infrastructure Planning",
    description: "Plan charging and hydrogen refueling infrastructure.",
    articles: [
      { title: "EV Charging Infrastructure", href: "#ev-charging" },
      { title: "H2 Station Planning", href: "#h2-stations" },
      { title: "Grid Capacity Assessment", href: "#grid-capacity" },
      { title: "Cost Estimation", href: "#infra-costs" },
    ]
  },
  {
    id: "analytics",
    icon: BarChart3,
    title: "Analytics & Reporting",
    description: "Generate insights and professional reports.",
    articles: [
      { title: "Portfolio Analytics", href: "#portfolio" },
      { title: "What-If Analysis", href: "#what-if" },
      { title: "Scenario Comparison", href: "#comparison" },
      { title: "PDF Reports", href: "#pdf-reports" },
    ]
  },
  {
    id: "collaboration",
    icon: Users,
    title: "Collaboration",
    description: "Work with your team on transition projects.",
    articles: [
      { title: "Inviting Team Members", href: "#invites" },
      { title: "Roles & Permissions", href: "#roles" },
      { title: "Comments & Notes", href: "#comments" },
      { title: "Version History", href: "#versions" },
    ]
  },
  {
    id: "reference-data",
    icon: Database,
    title: "Reference Data",
    description: "Customize and manage reference pricing data.",
    articles: [
      { title: "Regional Pricing", href: "#regional-pricing" },
      { title: "Custom Data Sources", href: "#custom-data" },
      { title: "Data Import/Export", href: "#import-export" },
      { title: "Subsidies Database", href: "#subsidies" },
    ]
  },
  {
    id: "api",
    icon: Code,
    title: "API Reference",
    description: "Integrate H2Fleet with your systems.",
    articles: [
      { title: "Authentication", href: "#auth" },
      { title: "Projects Endpoint", href: "#api-projects" },
      { title: "Scenarios Endpoint", href: "#api-scenarios" },
      { title: "TCO Calculation API", href: "#api-tco" },
    ]
  },
];

const quickLinks = [
  { title: "Create a Scenario", href: "/dashboard/scenarios/new" },
  { title: "View Guides", href: "/guides" },
  { title: "API Documentation", href: "/api-documentation" },
  { title: "Contact Support", href: "/support" },
];

const Docs = () => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSection, setActiveSection] = useState("getting-started");

  useEffect(() => {
    document.title = `Documentation - H2Fleet Planner`;
  }, []);

  const filteredSections = docSections.filter(section =>
    section.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    section.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    section.articles.some(article => 
      article.title.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-20">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <BookOpen className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              Documentation
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Everything you need to master fleet energy transition planning with H2Fleet.
            </p>
          </div>

          {/* Search */}
          <div className="max-w-xl mx-auto mb-12">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search documentation..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-12 text-lg"
              />
            </div>
          </div>

          {/* Quick Links */}
          <div className="flex flex-wrap justify-center gap-3 mb-12">
            {quickLinks.map((link) => (
              <Link key={link.href} to={link.href}>
                <Button variant="outline" size="sm" className="gap-2">
                  {link.title}
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </Link>
            ))}
          </div>

          {/* Main Content */}
          <div className="grid lg:grid-cols-4 gap-8">
            {/* Sidebar Navigation */}
            <div className="lg:col-span-1">
              <div className="sticky top-24">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-4">
                  Sections
                </h3>
                <ScrollArea className="h-[calc(100vh-200px)]">
                  <nav className="space-y-1">
                    {docSections.map((section) => (
                      <button
                        key={section.id}
                        onClick={() => setActiveSection(section.id)}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                          activeSection === section.id
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        <section.icon className="h-4 w-4" />
                        {section.title}
                      </button>
                    ))}
                  </nav>
                </ScrollArea>
              </div>
            </div>

            {/* Content Grid */}
            <div className="lg:col-span-3">
              <div className="grid md:grid-cols-2 gap-6">
                {filteredSections.map((section) => (
                  <Card 
                    key={section.id} 
                    className={`transition-all ${
                      activeSection === section.id ? "ring-2 ring-primary" : ""
                    }`}
                  >
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <section.icon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{section.title}</CardTitle>
                          <CardDescription>{section.description}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {section.articles.map((article, idx) => (
                          <li key={idx}>
                            <a 
                              href={article.href}
                              className="flex items-center text-sm text-muted-foreground hover:text-primary transition-colors group"
                            >
                              <ChevronRight className="h-4 w-4 mr-2 text-muted-foreground/50 group-hover:text-primary transition-colors" />
                              {article.title}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Help Section */}
              <div className="mt-12 p-8 bg-muted/50 rounded-xl text-center">
                <h3 className="text-xl font-semibold mb-2">Need more help?</h3>
                <p className="text-muted-foreground mb-4">
                  Can't find what you're looking for? Our team is here to help.
                </p>
                <div className="flex justify-center gap-4">
                  <Link to="/support">
                    <Button>Contact Support</Button>
                  </Link>
                  <Link to="/guides">
                    <Button variant="outline">View Guides</Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Docs;
