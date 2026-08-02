import {getCompanyInfo} from './app.services';
import {getCachedCompanyInfo, saveBootstrapCache} from '../db/sqlite';
import {getEffectiveIsOnline} from '../utils/posConnectivity';

export async function loadReceiptBusinessInfo(): Promise<Record<string, unknown>> {
  const cached = await getCachedCompanyInfo();
  if (cached) {
    if (getEffectiveIsOnline()) {
      void fetchAndCacheCompanyInfo().catch(() => undefined);
    }
    return cached;
  }
  return fetchAndCacheCompanyInfo();
}

async function fetchAndCacheCompanyInfo(): Promise<Record<string, unknown>> {
  const info = await getCompanyInfo();
  const payload = {company: info};
  await saveBootstrapCache({company_info: payload});
  return payload;
}
