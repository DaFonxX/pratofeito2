import { t } from '../../core/i18n.js';
import { reportPage } from '../../components/report.js';

export default async function adminReports({ root, query }) {
  const result = await reportPage({
    root,
    query,
    kind: 'admin',
    title: t('reports.adminTitle'),
    lead: t('reports.adminLead'),
    endpoint: '/admin/reports',
    csvEndpoint: '/admin/reports/orders.csv',
  });
  return { title: t('reports.adminTitle'), cleanup: result.cleanup };
}
