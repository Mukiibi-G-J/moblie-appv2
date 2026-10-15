import AsyncStorage from '@react-native-async-storage/async-storage';
import {createAxiosInstance} from '../axios/axios';

export type DashboardReportRow = {
  Label: string;
  FormattedAmount: string;
  Share: number;
};

export type DashboardReportStatement = {
  Title: string;
  TotalFormatted: string;
  Rows: DashboardReportRow[];
};

export type RoleCentreBreakdown = {
  ControlType: string;
  Caption?: string;
  WidgetCode?: string;
};

async function client() {
  const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
  return createAxiosInstance(tenant);
}

export async function fetchRoleCentreBreakdowns(
  pageId: number,
): Promise<RoleCentreBreakdown[]> {
  const axiosInstance = await client();
  const response = await axiosInstance.get<{Sections?: RoleCentreBreakdown[]}>(
    '/api/pages/rolecentre/',
    {params: {PageId: pageId}},
  );
  const sections = response?.data?.Sections;
  if (!Array.isArray(sections)) {
    return [];
  }
  return sections.filter(
    section => section?.ControlType === 'Breakdown' && section.WidgetCode,
  );
}

export async function fetchDashboardReport(
  code: string,
  startDate: string,
  endDate: string,
): Promise<DashboardReportStatement> {
  const axiosInstance = await client();
  const response = await axiosInstance.get<DashboardReportStatement>(
    '/api/pages/dashboard-report/',
    {params: {code, startDate, endDate}},
  );
  return response.data;
}

export async function exportDashboardReportPdf(
  code: string,
  startDate: string,
  endDate: string,
): Promise<{fileName: string; base64: string}> {
  const axiosInstance = await client();
  const response = await axiosInstance.get<{
    FileName?: string;
    FileBase64?: string;
  }>('/api/pages/dashboard-report/', {
    params: {code, startDate, endDate, export: 'pdf'},
  });
  const base64 = response?.data?.FileBase64 || '';
  if (!base64) {
    throw new Error('Preview returned no PDF.');
  }
  return {
    fileName: response.data.FileName || 'sales-by-category.pdf',
    base64,
  };
}
