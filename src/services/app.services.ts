import AsyncStorage from '@react-native-async-storage/async-storage';
import {ItemJournalData, SalesItem, SalesPostData} from '../@types/types.dto';
import {axiosInstance, createAxiosInstance} from '../axios/axios';
import {Product} from '../Screens/Products/Products';

// New function to search for products
export const searchItems = async (searchQuery: string) => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant) || undefined;
    const response = await axiosInstance.get(
      `/api/items/?q=${encodeURIComponent(searchQuery)}`,
    );
    return response.data.results; // Return the product data
  } catch (error) {
    throw error; // Handle errors
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
    let url = '/api/items/sales/filter/';
    if (filters?.startDate && filters?.endDate) {
      url += `?start_date=${encodeURIComponent(
        filters.startDate,
      )}&end_date=${encodeURIComponent(filters.endDate)}`;
    }
    const response = await axiosInstance.get<SalesItem[]>(url);
    return response.data.results;
  } catch (error) {
    throw error; // Handle errors
  }
};

export const createSales = async (salesData: SalesPostData[]) => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant) || undefined;
    const response = await axiosInstance.post(
      '/api/sales/create-sale/',
      salesData,
    );
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
      '/api/sales/post-item-journal/',
      itemJournalData,
    );
    return response;
  } catch (error) {
    return {error: error};
  }
};

// product list api
export const fetchProducts = async (
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
    console.error('Error fetching products:', error);
    throw error;
  }
};

// Add this new API call for categories
export const fetchCategories = async () => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant) || undefined;
    const response = await axiosInstance.get('/api/items/item-categories/');
    return response.data;
  } catch (error) {
    console.error('Error fetching categories:', error);
    throw error;
  }
};

export const updateProduct = async (
  productId: number,
  productData: Product,
) => {
  try {
    const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
    const axiosInstance = createAxiosInstance(tenant) || undefined;
    const response = await axiosInstance.put(
      `/api/items/item-update/${productId}/`,
      productData,
    );
    return response;
  } catch (error) {
    throw error;
  }
};

// Create a function to get the configured axios instance
const getAxiosInstance = async () => {
  const tenant = await AsyncStorage.getItem('tenant');
  return tenant ? createAxiosInstance(tenant) : axiosInstance;
};

// Update fetchItemJournal to accept pagination parameters
export const fetchItemJournal = async (
  page: number = 1,
  searchQuery: string = '',
) => {
  try {
    const api = await getAxiosInstance();
    const response = await api.get('/api/items/item-journal/', {
      params: {
        page,
        q: searchQuery.trim(),
      },
    });
    console.log('request url', response.config.url);
    return response.data;
  } catch (error) {
    console.log('error', error.response.data);
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
      `/api/items/item-journal/${itemJournalId}/`,
      itemJournalData,
    );
    console.log('request url', response.config.url);
    return response;
  } catch (error) {
    console.log;
    throw error;
  }
};
