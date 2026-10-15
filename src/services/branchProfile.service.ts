import AsyncStorage from '@react-native-async-storage/async-storage';
import {createAxiosInstance} from '../axios/axios';

export type UserProfileBranchFields = {
  dimension_1: string | null;
  dimension_1_description: string | null;
};

export type BranchListRow = {
  id: number;
  code: string;
  description: string;
};

function normalizeBranchCode(raw: unknown): string | null {
  if (raw == null) {
    return null;
  }
  const s = String(raw).trim();
  return s.length > 0 ? s : null;
}

/**
 * Profile may omit dimension_1 even when the tenant has branches (e.g. single-branch
 * companies). If there is exactly one branch, treat it as the effective branch for display.
 */
export function resolveEffectiveBranchCode(
  profileBranchCode: string | null | undefined,
  branches: BranchListRow[],
): string | null {
  const code = profileBranchCode?.trim() || null;
  if (code) {
    return code;
  }
  if (branches.length === 1) {
    return branches[0].code;
  }
  return null;
}

export async function fetchUserProfileBranchFields(): Promise<UserProfileBranchFields> {
  const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
  const api = createAxiosInstance(tenant);
  const res = await api.get('/api/auth/profile/');
  const data = res.data;
  // Backend `get_user_profile` returns `global_dimension_1: { id, code, description }`, not `dimension_1`.
  const gd1 = data?.global_dimension_1;
  const fromObj =
    gd1 && typeof gd1 === 'object'
      ? {
          code: normalizeBranchCode((gd1 as {code?: unknown}).code),
          description:
            typeof (gd1 as {description?: unknown}).description === 'string' &&
            String((gd1 as {description: string}).description).trim()
              ? String((gd1 as {description: string}).description).trim()
              : null,
        }
      : {code: null as string | null, description: null as string | null};
  return {
    dimension_1: fromObj.code ?? normalizeBranchCode(data?.dimension_1),
    dimension_1_description:
      fromObj.description ??
      (typeof data?.dimension_1_description === 'string' &&
      data.dimension_1_description.trim()
        ? data.dimension_1_description.trim()
        : null),
  };
}

type SalesSetupBranchValue = {id: number; code: string; description: string};

export type SalesSetupBranchConfig = {
  enable_multiple_branches: boolean;
  branch_values: BranchListRow[];
};

function mapSetupBranchValues(raw: unknown): BranchListRow[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((v: any) => ({
      id: Number(v?.id),
      code: String(v?.code ?? '').trim(),
      description: String(v?.description ?? v?.code ?? '').trim(),
    }))
    .filter((v) => Number.isFinite(v.id) && v.code.length > 0)
    .map((v) => ({
      ...v,
      description: v.description || v.code,
    }));
}

/** Same source as web `SalesServices.getSalesSetup()` for branch picker. */
export async function fetchSalesSetupBranchConfig(): Promise<SalesSetupBranchConfig> {
  const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
  const api = createAxiosInstance(tenant);
  const res = await api.get('/api/sales/setup/');
  const d = res?.data ?? {};
  return {
    enable_multiple_branches: d?.enable_multiple_branches === true,
    branch_values: mapSetupBranchValues(d?.branch_values),
  };
}

async function fetchSalesSetupBranchValues(): Promise<SalesSetupBranchValue[]> {
  const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
  const api = createAxiosInstance(tenant);
  const res = await api.get('/api/sales/setup/');
  const d = res?.data ?? {};
  const values = d?.branch_values;
  if (!Array.isArray(values)) {
    return [];
  }
  return values
    .map((v: any) => ({
      id: Number(v?.id),
      code: String(v?.code ?? '').trim(),
      description: String(v?.description ?? v?.code ?? '').trim(),
    }))
    .filter((v) => Number.isFinite(v.id) && v.code.length > 0);
}

/** Full branch list (not paginated); same source as the web company UI. */
export async function fetchCompanyBranches(): Promise<BranchListRow[]> {
  const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
  const api = createAxiosInstance(tenant);
  const res = await api.get('/api/company/branches/');
  const data = res.data;

  const rawRows: Array<{id?: unknown; code?: unknown; name?: unknown; description?: unknown}> =
    Array.isArray(data) ? data : [];

  // Prefer IDs from the company branches endpoint when available.
  const direct = rawRows
    .map((row) => ({
      id: Number(row.id),
      code: String(row.code ?? '').trim(),
      description: String(row.name ?? row.description ?? row.code ?? '').trim(),
    }))
    .filter((row) => Number.isFinite(row.id) && row.code.length > 0)
    .map((row) => ({
      ...row,
      description: row.description || row.code,
    }));

  if (direct.length > 0) {
    return direct;
  }

  // Fallback: resolve IDs via /api/sales/setup/ (web parity: `branch_values` with numeric IDs).
  const setupValues = await fetchSalesSetupBranchValues();
  const setupByCode = new Map(setupValues.map((v) => [v.code, v]));

  const byCode = rawRows
    .map((row) => {
      const code = String(row.code ?? '').trim();
      const fromSetup = setupByCode.get(code);
      return {
        id: fromSetup?.id ?? NaN,
        code,
        description:
          String(row.name ?? row.description ?? '').trim() ||
          fromSetup?.description ||
          code,
      };
    })
    .filter((row) => Number.isFinite(row.id) && row.code.length > 0) as BranchListRow[];

  return byCode;
}
