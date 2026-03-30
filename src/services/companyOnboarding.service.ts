import {createAxiosInstance} from '../axios/axios';

/** Always use public API host — no tenant subdomain or AsyncStorage tenant. */
function publicApi() {
  return createAxiosInstance(undefined);
}

export type CompanySubscriptionPayload = {
  plan: string;
  price: number;
  yearlyPrice: number;
};

export type CreateCompanyAccountPayload = {
  companyName: string;
  companyEmail: string;
  companyPhone: string;
  companyAddress: string;
  companyCity: string;
  companyCountry: string;
  userName: string;
  fullName: string;
  password: string;
  organization_size: string;
  business_category: string;
  business_objective: string;
  subscription: CompanySubscriptionPayload;
};

export type CreateCompanyAccountResponse = {
  message: string;
  task_id: string;
  company_name: string;
};

export type TaskStatusResponse = {
  state: string;
  progress: number;
  message: string;
  status: string;
  result?: Record<string, unknown>;
};

export type CompanyValidationResponse = {
  isValid: boolean;
  message: string;
  errors?: string[];
};

export type OnboardingBusinessObjective = {
  id: number;
  description: string;
  icon_path?: string;
};

export type OnboardingBusinessCategory = {
  id: number;
  name: string;
  icon_path?: string;
};

export type OnboardingDataResponse = {
  business_objectives: OnboardingBusinessObjective[];
  business_categories: OnboardingBusinessCategory[];
};

export async function createCompanyAccount(data: CreateCompanyAccountPayload) {
  const api = publicApi();
  return api.post<CreateCompanyAccountResponse>(
    '/api/company/create-company-account/',
    data,
  );
}

export async function getCompanyCreationTaskStatus(taskId: string) {
  const api = publicApi();
  return api.get<TaskStatusResponse>(
    `/api/company/task-status/${taskId}/`,
  );
}

export async function validateCompanyNameApi(companyName: string) {
  const api = publicApi();
  return api.post<CompanyValidationResponse>(
    '/api/company/validate-company-name/',
    {company_name: companyName.trim()},
  );
}

export async function getOnboardingDataApi() {
  const api = publicApi();
  return api.get<OnboardingDataResponse>('/api/home/on-boarding/');
}

const DEFAULT_POLL_MS = 2000;
const MAX_POLL_ATTEMPTS = 180;

export async function pollCompanyCreationTask(
  taskId: string,
  options?: {
    intervalMs?: number;
    onProgress?: (data: TaskStatusResponse) => void;
  },
): Promise<TaskStatusResponse> {
  const interval = options?.intervalMs ?? DEFAULT_POLL_MS;

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    const {data} = await getCompanyCreationTaskStatus(taskId);
    options?.onProgress?.(data);

    if (data.state === 'SUCCESS') {
      return data;
    }
    if (data.state === 'FAILURE') {
      throw Object.assign(new Error(data.message || 'Company creation failed'), {
        taskStatus: data,
      });
    }
    await new Promise<void>(resolve => setTimeout(resolve, interval));
  }

  throw new Error(
    'Company setup is taking longer than expected. Please check your connection or try again later.',
  );
}
