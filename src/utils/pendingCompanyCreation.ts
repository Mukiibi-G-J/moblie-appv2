import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "@pending_company_creation";

export type PendingCompanyCreation = {
    taskId: string;
    /** Lowercase tenant slug (same as `setTenant` first arg). */
    companyName: string;
    email: string;
};

export async function savePendingCompanyCreation(
    data: PendingCompanyCreation,
): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export async function getPendingCompanyCreation(): Promise<PendingCompanyCreation | null> {
    try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return null;
        }
        const parsed = JSON.parse(raw) as Partial<PendingCompanyCreation>;
        if (
            typeof parsed.taskId === "string" &&
            typeof parsed.companyName === "string" &&
            typeof parsed.email === "string"
        ) {
            return {
                taskId: parsed.taskId,
                companyName: parsed.companyName,
                email: parsed.email,
            };
        }
        return null;
    } catch {
        return null;
    }
}

export async function clearPendingCompanyCreation(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEY);
}
