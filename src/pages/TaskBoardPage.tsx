import React from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { TaskBoard } from '@/components/tasks';

export default function TaskBoardPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { t } = useTranslation();

  if (!projectId) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <p className="text-muted-foreground">{t('common.projectNotFound', 'Project not found')}</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 h-[calc(100vh-64px)]">
        <TaskBoard projectId={projectId} />
      </div>
    </DashboardLayout>
  );
}
