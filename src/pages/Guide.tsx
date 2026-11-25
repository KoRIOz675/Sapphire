import { useTranslation } from "react-i18next";
import {
  Users,
  Building2,
  ListChecks,
  FolderKanban,
  LayoutDashboard,
  Tag,
  DatabaseBackup,
  Keyboard,
} from "lucide-react";

import PageHeader from "../components/PageHeader";

interface SectionProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

function GuideSection({ icon, title, description }: SectionProps) {
  return (
    <section className="card flex gap-4">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-sapphire-50 text-sapphire-600">
        {icon}
      </div>
      <div>
        <h3 className="mb-1 text-sm font-semibold text-slate-800">{title}</h3>
        <p className="text-sm text-slate-600">{description}</p>
      </div>
    </section>
  );
}

export default function Guide() {
  const { t } = useTranslation();

  const sections: SectionProps[] = [
    {
      icon: <Users className="h-4 w-4" />,
      title: t("guide.section_people"),
      description: t("guide.section_people_desc"),
    },
    {
      icon: <LayoutDashboard className="h-4 w-4" />,
      title: t("guide.section_circles"),
      description: t("guide.section_circles_desc"),
    },
    {
      icon: <Building2 className="h-4 w-4" />,
      title: t("guide.section_companies"),
      description: t("guide.section_companies_desc"),
    },
    {
      icon: <ListChecks className="h-4 w-4" />,
      title: t("guide.section_actions"),
      description: t("guide.section_actions_desc"),
    },
    {
      icon: <FolderKanban className="h-4 w-4" />,
      title: t("guide.section_projects"),
      description: t("guide.section_projects_desc"),
    },
    {
      icon: <Tag className="h-4 w-4" />,
      title: t("guide.section_tags"),
      description: t("guide.section_tags_desc"),
    },
    {
      icon: <LayoutDashboard className="h-4 w-4" />,
      title: t("guide.section_dashboard"),
      description: t("guide.section_dashboard_desc"),
    },
    {
      icon: <DatabaseBackup className="h-4 w-4" />,
      title: t("guide.section_backup"),
      description: t("guide.section_backup_desc"),
    },
    {
      icon: <Keyboard className="h-4 w-4" />,
      title: t("guide.section_shortcuts"),
      description: t("guide.section_shortcuts_desc"),
    },
  ];

  return (
    <>
      <PageHeader title={t("guide.title")} />

      <p className="mb-6 text-sm text-slate-600">{t("guide.intro")}</p>

      <div className="grid gap-4 md:grid-cols-2">
        {sections.map((s) => (
          <GuideSection key={s.title} {...s} />
        ))}
      </div>
    </>
  );
}
