import AsyncStorage from '@react-native-async-storage/async-storage';

const BRANCH_ACTIVE_ID_KEY = 'branch.active_branch_id';
const BRANCH_ACTIVE_KEY = 'branch.active_branch';

/** Branch dimension id for writes (web `selectEffectiveBranch` / AutoSaveField parity). */
export async function resolveEffectiveBranchDimensionId(): Promise<number | null> {
  try {
    const rawId = await AsyncStorage.getItem(BRANCH_ACTIVE_ID_KEY);
    if (rawId != null && rawId !== '') {
      const id = Number(rawId);
      if (Number.isFinite(id)) {
        return id;
      }
    }

    const rawBranch = await AsyncStorage.getItem(BRANCH_ACTIVE_KEY);
    if (rawBranch) {
      const branch = JSON.parse(rawBranch) as {id?: number};
      if (branch?.id != null && Number.isFinite(Number(branch.id))) {
        return Number(branch.id);
      }
    }

    const userData = await AsyncStorage.getItem('userData');
    if (userData) {
      const parsed = JSON.parse(userData) as {
        global_dimension_1?: {id?: number};
      };
      const gdId = parsed?.global_dimension_1?.id;
      if (gdId != null && Number.isFinite(Number(gdId))) {
        return Number(gdId);
      }
    }
  } catch {
    /* non-fatal */
  }
  return null;
}
