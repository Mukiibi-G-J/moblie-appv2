import React from 'react';
import {
  View,
  Text,
  TextInput,
  ViewStyle,
  KeyboardTypeOptions,
  TextStyle,
} from 'react-native';

import {FONTS, SIZES, COLORS} from '../constants';
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
  helperText?: string;
}
const FormInput = ({
  containerStyle,
  inputContainerStyle,
  label,
  placeholder,
  inputStyle,
  value = '',
  prependComponent,
  appendComponent,
  onChange,
  secureTextEntry,
  keyboardType = 'default',
  autoCompleteType = 'off',
  autoCapitalize = 'none',
  errorMsg = '',
  maxLength,
  helperText,
}: FormInputProps) => {
  return (
    <View style={{...containerStyle}}>
      <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
        <Text style={{color: COLORS.gray, ...FONTS.body4}}>{label}</Text>
        <Text style={{color: COLORS.red, ...FONTS.body4}}>{errorMsg}</Text>
      </View>

      <View
        style={{
          flexDirection: 'row',
          height: SIZES.height > 800 ? 55 : 45,
          paddingHorizontal: SIZES.padding,
          marginTop: SIZES.height > 800 ? SIZES.base : 0,
          borderRadius: SIZES.radius,
          backgroundColor: COLORS.lightGray2,
          ...inputContainerStyle,
        }}>
        {prependComponent}
        <TextInput
          style={{flex: 1, ...inputStyle, color: 'black'}}
          value={value}
          placeholder={placeholder}
          placeholderTextColor={COLORS.gray}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCompleteType={autoCompleteType}
          autoCapitalize={autoCapitalize}
          maxLength={maxLength}
          onChangeText={text => onChange(text)}
          textContentType={autoCompleteType}
        />
        {appendComponent}
      </View>
      <Text style={{color: COLORS.gray, ...FONTS.body4}}>{helperText}</Text>
    </View>
  );
};

export default FormInput;
