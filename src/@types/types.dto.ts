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

declare type AuthLayoutProps = {
  title: string;
  subtitle?: string;
  titleContainerStyle?: CSSProperties;
  children?: ReactNode;
};

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

export interface ItemJournalData {
  journal_ids: number[];
}


interface FormInputProps {
  containerStyle?: ViewStyle;
  inputContainerStyle?: ViewStyle;
  label?: string;
  placeholder?: string;
  inputStyle?: TextStyle;
  value?: string;
  prependComponent?: React.ReactNode;
  appendComponent?: React.ReactNode;
  onChange: (text: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCompleteType?: string;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  errorMsg?: string;
  maxLength?: number;
}