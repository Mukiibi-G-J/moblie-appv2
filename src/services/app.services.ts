import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ItemJournalData,
  SalesItem,
  SalesPostData,
  SalesInvoiceData,
} from '../@types/types.dto';
import {axiosInstance, createAxiosInstance} from '../axios/axios';
import {Item} from '../Screens/Items/Items';

// New function to search for items
export const searchItems = async (searchQuery: string) => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant) || undefined;
    const response = await axiosInstance.get(
      `/api/items/?q=${encodeURIComponent(searchQuery)}`,
    );
    return response.data.results; // Return the item data
  } catch (error) {
    throw error; // Handle errors
  }
};

export type SalesCategoryRow = {
  Label: string;
  Amount: number;
  FormattedAmount: string;
  Share: number;
};

export type SalesCategoryStatement = {
  Title: string;
  CompanyName: string;
  StartDate: string;
  EndDate: string;
  CurrencyCode: string;
  Total: number;
  TotalFormatted: string;
  Rows: SalesCategoryRow[];
};

/** Home report. 403/404 return null so callers can hide the card. */
export const fetchSalesByCategory = async (
  startDate: string,
  endDate: string,
): Promise<SalesCategoryStatement | null> => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const client = createAxiosInstance(tenant);
    const response = await client.get('/api/pages/dashboard-report/', {
      params: {
        code: 'sales-by-sales-category',
        startDate,
        endDate,
      },
      skipAuthFailure: true,
    } as any);
    return response.data as SalesCategoryStatement;
  } catch (error: any) {
    const status = error?.response?.status;
    if (status === 403 || status === 404) {
      return null;
    }
    throw error;
  }
};

// New function to fetch sales data
export const fetchSalesData = async (filters?: {
  startDate?: string;
  endDate?: string;
}) => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant) || undefined;

    // Build query parameters based on the backend API structure
    const params: any = {
      status: 'Posted', // Only fetch posted sales
    };

    if (filters?.startDate) {
      params.document_date__gte = filters.startDate;
    }
    if (filters?.endDate) {
      params.document_date__lte = filters.endDate;
    }

    const response = await axiosInstance.get('/api/sales/', {params});

    if (response?.data?.results && Array.isArray(response.data.results)) {
      return response.data.results;
    }
    return [];
  } catch (error: any) {
    console.error('Error fetching sales data:', error);
    throw error;
  }
};

export const createSales = async (salesData: SalesPostData[]) => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant) || undefined;
    console.log('DEBUG: Sending sales invoice data:', salesData);
    const response = await axiosInstance.post('/api/sales/', salesData);
    return response;
  } catch (error) {
    throw error;
  }
};

export const postSalesInvoice = async (salesId: number) => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant) || undefined;

    // Use the correct endpoint from frontend
    const endpoint = `/api/sales/${salesId}/post_sale/`;

    console.log(`DEBUG: Posting sales invoice at: ${endpoint}`);
    const response = await axiosInstance.post(endpoint);
    console.log(`DEBUG: Successfully posted at: ${endpoint}`);
    return response;
  } catch (error) {
    console.error('DEBUG: Error posting sales invoice:', error);
    throw error;
  }
};

export const createSalesInvoice = async (
  salesInvoiceData: SalesInvoiceData,
) => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant) || undefined;
    console.log('DEBUG: Sending sales invoice data:', salesInvoiceData);
    const response = await axiosInstance.post('/api/sales/', salesInvoiceData);

    // After creating the invoice, try to post it automatically
    if (response.data && response.data.id) {
      try {
        const postResult = await postSalesInvoice(response.data.id);
        if (
          postResult &&
          typeof postResult === 'object' &&
          'success' in postResult &&
          postResult.success
        ) {
          console.log('DEBUG: Sales invoice posted successfully');
        } else {
          console.log('DEBUG: Sales invoice created but posting not available');
        }
      } catch (postError) {
        console.error('DEBUG: Error posting sales invoice:', postError);
        // Continue with the response even if posting fails
      }
    }

    return response;
  } catch (error) {
    throw error;
  }
};

export const postItemJournal = async (itemJournalData: ItemJournalData) => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant) || undefined;
    const response = await axiosInstance.post(
      '/api/item-journals/',
      itemJournalData,
    );
    return response;
  } catch (error) {
    return {error: error};
  }
};

// items list api
export const fetchItems = async (
  page: number = 1,
  searchQuery: string = '',
) => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant) || undefined;
    const response = await axiosInstance.get(`/api/items/`, {
      params: {
        page,
        q: searchQuery.trim(),
      },
    });
    console.log('response', response.data);
    return response.data;
  } catch (error) {
    console.error('Error fetching items:', error);
    throw error;
  }
};

// Add this new API call for categories
export const fetchCategories = async () => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant) || undefined;
    const response = await axiosInstance.get('/api/categories/');
    return response.data;
  } catch (error) {
    console.error('Error fetching categories:', error);
    throw error;
  }
};

export const updateItem = async (itemId: string | number, itemData: Item) => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant) || undefined;
    const response = await axiosInstance.put(`/api/items/${itemId}/`, itemData);
    return response;
  } catch (error) {
    throw error;
  }
};

// Upload image for an item
export const uploadItemImage = async (
  itemId: string | number,
  imageUri: string,
) => {
  try {
    console.log('uploadItemImage called with:', {itemId, imageUri});

    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant) || undefined;

    // Create FormData for file upload
    const formData = new FormData();

    // Get file name and type from URI
    let fileName = 'image.jpg';
    let fileType = 'jpeg';

    if (imageUri.startsWith('content://')) {
      // For content:// URIs, we need to handle them differently
      fileName = `image_${Date.now()}.jpg`;
      fileType = 'jpeg';
    } else if (imageUri.startsWith('file://')) {
      // For file:// URIs, try to extract the extension
      const pathParts = imageUri.split('/');
      fileName = pathParts.pop() || 'image.jpg';
      const extension = fileName.split('.').pop()?.toLowerCase();

      // Map common extensions to MIME types
      if (extension === 'png') {
        fileType = 'png';
      } else if (extension === 'gif') {
        fileType = 'gif';
      } else if (extension === 'webp') {
        fileType = 'webp';
      } else {
        // Default to jpeg for unknown extensions
        fileType = 'jpeg';
        if (!fileName.includes('.')) {
          fileName = `${fileName}.jpg`;
        }
      }
    }

    console.log('File info:', {fileName, fileType, imageUri});

    // Append the item ID and image file according to the backend API
    formData.append('item', itemId.toString());
    formData.append('url', {
      uri: imageUri,
      type: `image/${fileType}`,
      name: fileName,
    } as any);

    // Use the correct endpoint based on the backend analysis
    const response = await axiosInstance.post('/api/item-images/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    console.log('Upload response:', response.data);
    return response;
  } catch (error: any) {
    console.error('Error uploading image:', error);
    // Provide more specific error messages
    if (error.response?.status === 413) {
      throw new Error(
        'Image file is too large. Please select a smaller image.',
      );
    } else if (error.response?.status === 415) {
      throw new Error(
        'Unsupported image format. Please select a JPG, PNG, or GIF image.',
      );
    } else if (error.response?.status === 401) {
      throw new Error('Authentication failed. Please log in again.');
    } else if (error.response?.status === 403) {
      throw new Error(
        'You do not have permission to upload images for this item.',
      );
    } else {
      throw error;
    }
  }
};

// Delete image for an item
export const deleteItemImage = async (imageId: number) => {
  try {
    console.log('deleteItemImage called with imageId:', imageId);

    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant) || undefined;

    // Use the correct endpoint based on the backend analysis
    const response = await axiosInstance.delete(`/api/item-images/${imageId}/`);

    console.log('Delete response:', response.data);
    return response;
  } catch (error: any) {
    console.error('Error deleting image:', error);
    // Provide more specific error messages
    if (error.response?.status === 404) {
      throw new Error('Image not found. It may have already been deleted.');
    } else if (error.response?.status === 401) {
      throw new Error('Authentication failed. Please log in again.');
    } else if (error.response?.status === 403) {
      throw new Error('You do not have permission to delete this image.');
    } else {
      throw error;
    }
  }
};

// Create a function to get the configured axios instance
const getAxiosInstance = async () => {
  const tenant = await AsyncStorage.getItem('tenant');
  return tenant ? createAxiosInstance(tenant) : axiosInstance;
};

// Get company information
export const getCompanyInfo = async () => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant) || undefined;
    const response = await axiosInstance.get('/api/sales/company-info/');
    return response;
  } catch (error: any) {
    console.error('Error fetching company info:', error);
    throw error;
  }
};

// Update fetchItemJournal to accept pagination parameters
export const fetchItemJournal = async (
  page: number = 1,
  searchQuery: string = '',
) => {
  try {
    const api = await getAxiosInstance();
    const response = await api.get('/api/item-journals/', {
      params: {
        page,
        q: searchQuery.trim(),
      },
    });
    console.log('request url', response.config.url);
    return response.data;
  } catch (error: any) {
    console.log('error', error.response?.data);
    throw error;
  }
};

// Update updateItemJournal similarly
export const updateItemJournal = async (
  itemJournalId: number,
  itemJournalData: ItemJournalData,
) => {
  try {
    const api = await getAxiosInstance();
    const response = await api.put(
      `/api/item-journals/${itemJournalId}/`,
      itemJournalData,
    );
    console.log('request url', response.config.url);
    return response;
  } catch (error: any) {
    console.log('error', error.response?.data);
    throw error;
  }
};

// Customer types
export interface Customer {
  id: number;
  no: string;
  name: string;
  system_id: string;
}

// Payment method types
export interface PaymentMethod {
  id: number;
  code: string;
  description: string;
  bal_account_type: string;
  bal_account_no: string;
  system_id: string;
  requires_amount_received: boolean;
}

/**
 * Fetch customers from API
 */
export const fetchCustomers = async (): Promise<Customer[]> => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const api = createAxiosInstance(tenant) || axiosInstance;
    const response = await api.get('/api/customers/');
    if (response?.data?.results && Array.isArray(response.data.results)) {
      return response.data.results;
    }
    return [];
  } catch (error: any) {
    console.error('Error fetching customers:', error);
    return [];
  }
};

/**
 * Fetch payment methods from API
 */
export const fetchPaymentMethods = async (): Promise<PaymentMethod[]> => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const api = createAxiosInstance(tenant) || axiosInstance;
    const response = await api.get('/api/financials/payment-methods/');
    if (response?.data && Array.isArray(response.data)) {
      return response.data;
    }
    return [];
  } catch (error: any) {
    console.error('Error fetching payment methods:', error);
    return [];
  }
};
