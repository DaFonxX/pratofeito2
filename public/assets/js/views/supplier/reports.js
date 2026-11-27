import { t } from '../../core/i18n.js';
import { session } from '../../core/store.js';
import { reportPage } from '../../components/report.js';

export default async function supplierReports({ root, query }) {
  const result = await reportPage({
    root,
    query,
    kind: 'store',
    title: t('reports.storeTitle'),
    lead: t('reports.storeLead', { store: session.user?.store?.name ?? '' }),
    endpoint: '/supplier/reports',
    csvEndpoint: '/supplier/reports/orders.csv',
  });
  return { title: t('reports.storeTitle'), cleanup: result.cleanup };
}
