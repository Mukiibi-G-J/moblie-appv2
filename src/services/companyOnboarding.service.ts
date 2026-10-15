import {createAnonymousAxiosInstance} from '../axios/axios';

/** Public onboarding endpoints — no auth token or branch headers. */
function publicApi() {
  return createAnonymousAxiosInstance(undefined);
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
  signup_complete?: boolean;
  user_ready?: boolean;
  workspace_ready?: boolean;
  login_url?: string;
};

export type TaskStatusResponse = {
  state: string;
  progress: number;
  message: string;
  status: string;
  result?: Record<string, unknown>;
  user_ready?: boolean;
  workspace_ready?: boolean;
};

export type WorkspaceStatusResponse = {
  schema: string;
  user_ready?: boolean;
  workspace_ready: boolean;
  progress: number;
  message: string;
  task_id?: string;
  state: string;
};

export function isWorkspaceProvisioningError(error: unknown): boolean {
  if (typeof error === 'string') {
    const text = error.toLowerCase();
    return (
      text.includes('still being set up') ||
      text.includes('still being created') ||
      text.includes('workspace_provisioning')
    );
  }
  const ax = error as {
    message?: string;
    response?: {status?: number; data?: Record<string, unknown>};
    error_type?: string;
    data?: Record<string, unknown>;
  };
  const data = ax.response?.data || ax.data;
  if (data?.error_type === 'workspace_provisioning') {
    return true;
  }
  if (
    ax.response?.status === 503 &&
    (data?.workspace_ready === false || data?.user_ready === false)
  ) {
    return true;
  }
  const message = String(ax.message || '');
  return (
    message.toLowerCase().includes('still being set up') ||
    message.toLowerCase().includes('still being created')
  );
}

export function isSignupAccountReady(
  data?: Partial<TaskStatusResponse & WorkspaceStatusResponse> | null,
): boolean {
  if (!data) {
    return false;
  }
  if (data.state === 'FAILURE') {
    return false;
  }
  if (data.user_ready) {
    return true;
  }
  if (data.status === 'user_ready') {
    return true;
  }
  if (data.workspace_ready) {
    return true;
  }
  return data.state === 'SUCCESS';
}

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

export async function getWorkspaceStatus(schema: string) {
  const api = publicApi();
  return api.get<WorkspaceStatusResponse>('/api/company/workspace-status/', {
    params: {schema: schema.trim().toLowerCase()},
  });
}

export async function validateCompanyNameApi(companyName: string) {
  const api = publicApi();
  return api.post<CompanyValidationResponse>(
    '/api/company/validate-company-name/',
    {company_name: companyName.trim()},
    {
      validateStatus: status => status >= 200 && status < 500,
    },
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

    if (isSignupAccountReady(data)) {
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
