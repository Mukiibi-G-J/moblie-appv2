import {
  KeyboardTypeOptions,
  TextStyle,
  TouchableOpacityProps,
  ViewStyle,
} from 'react-native';
import React from 'react';

export interface ButtonProps extends TouchableOpacityProps {
  title?: string;
  bgVariant?:
    | 'primary'
    | 'secondary'
    | 'danger'
    | 'outline'
    | 'success'
    | 'null';
  textVariant?: 'primary' | 'default' | 'secondary' | 'danger' | 'success';
  IconLeft?: React.ComponentType<any>;
  IconRight?: React.ComponentType<any>;
  className?: string;
  label?: string;
  label2?: string;
  buttonContainerStyle?: string;
}

declare interface FormInputProps {
  containerStyle?: ViewStyle;
  inputContainerStyle?: ViewStyle;
  label?: string;
  placeholder?: string;
  inputStyle?: TextStyle;
  value?: string;
  prependComponent?: React.ReactNode;
  appendComponent?: React.ReactNode;
  onChange?: (text: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCompleteType?:
    | 'off'
    | 'username'
    | 'password'
    | 'email'
    | 'name'
    | 'tel'
    | 'street-address'
    | 'postal-code'
    | 'cc-number'
    | 'cc-csc';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  errorMsg?: string;
  maxLength?: number;
}

declare type FieldSpec = {
  label: string;
  placeholder: string;
  keyboardType: string;
  autoCompleteType: string;
  value: string;
  errorMsg?: string;
  setValue: (value: string) => void;
  validate?: (value: string, setErrorMsg: (msg: string) => void) => void;
  icon?: {
    source: any;
    tintColor: string;
  };
};

export interface SalesItem {
  item: {
    bar_code_no: string;
    system_id: string;
    item_name: string;
    inventory: number;
    unit_price: number;
    item_images: Array<{
      id: number;
      created_at: string;
      updated_at: string;
      system_id: string;
      alt_text: string;
      url: string;
      item: number;
    }>;
  };
  date: string;
  quantity: number;
  unit_cost: number;
  unit_amount: number;
  amount: number;
  system_id: string;
}

export interface SalesPostData {
  item: number;
  entry_type: string;
  description: string;
  quantity: number;
  unit_amount: number;
  date: string;
  user: number;
}

export interface SalesInvoiceData {
  customer: number;
  customer_name: string;
  document_date: string;
  status: 'Open';
  total_amount: number;
  amount_received: number;
  change_amount: number;
  payment_method: number;
  user?: number;
  lines: Array<{
    id: number;
    item: string; // Changed back to string - should be item.no
    item_no: string; // Required field
    item_name: string;
    quantity: string;
    unit_price: string;
    total_amount: string;
    unit_of_measure: string;
    tracking_code: string;
    description: string;
  }>;
}

export interface TrackingCodeRequirement {
  system_id?: string;
  code?: string;
  description?: string;
  require_serial_no?: boolean;
  require_lot_no?: boolean;
  require_expiry_date?: boolean;
}

export interface SelectedTrackingDetails {
  lotNo?: string | null;
  serialNo?: string | null;
  expiryDate?: string | null;
  code?: string | null;
}

export interface ItemJournalData {
  document_ids: number[];
}

export interface CartItem {
  item_id?: number;
  system_id: string;
  item_name: string;
  unit_price: number;
  quantity: number;
  inventory: number;
  /** Item type from API (e.g. Inventory) — used to decide if lot tracking is enforced */
  type?: string;
  unit_of_measure?: string;
  no?: string; // Add the item number field
  item_images?: {
    id: number;
    created_at: string;
    system_id: string;
    updated_at: string;
    alt_text: string;
    url: string;
    item: number;
  }[];
  date_sold: string;
  tracking_code?: TrackingCodeRequirement | null;
  selectedTrackingCode?: string | null;
  trackingDetails?: SelectedTrackingDetails;
  bar_code_no?: string;
}

export interface CartState {
  cartItems: CartItem[];
}

export type CartAction =
  | {type: 'CART_ADD_ITEM'; payload: CartItem}
  | {type: 'REMOVE_FROM_CART'; payload: {system_id: string}}
  | {
      type: 'UPDATE_CART_ITEM_QUANTITY';
      payload: {system_id: string; quantity: number};
    }
  | {type: 'CART_UPDATE_ITEM'; payload: CartItem}
  | {type: 'CLEAR_CART'};

export type RootStackParamList = {
  OnBoarding: undefined;
  SignIn: undefined;
  SignUp: undefined;
  CompanyProvisioning: undefined;
  Otp: {email?: string};
  Login: undefined;
  Home: undefined;
};

export interface MenuItem {
  id: number;
  name: string;
  description: string;
  categories: number[];
  price: number;
  calories: number;
  isFavourite: boolean;
  image: any;
}

export interface MenuCategory {
  id: number;
  name: string;
  list: MenuItem[];
}
