import React from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  ViewStyle,
  TextInputProps,
  ActivityIndicator,
} from 'react-native';
import {COLORS, FONTS, SIZES} from '../constants';

interface FormInputProps extends TextInputProps {
  label: string;
  error?: string;
  helpText?: string;
  containerStyle?: ViewStyle;
  isLoading?: boolean;
  successMessage?: string;
  required?: boolean;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
}

const FormInput: React.FC<FormInputProps> = ({
  label,
  error,
  helpText,
  containerStyle,
  isLoading,
  successMessage,
  required = false,
  startIcon,
  endIcon,
  ...textInputProps
}) => {
  return (
    <View style={[styles.container, containerStyle]}>
      <View style={styles.labelContainer}>
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
      </View>

      <View
        style={[
          styles.inputContainer,
          error ? styles.inputError : successMessage ? styles.inputSuccess : {},
        ]}>
        {startIcon && (
          <View style={styles.startIconContainer}>{startIcon}</View>
        )}

        <TextInput
          style={[
            styles.input,
            startIcon ? {paddingLeft: 48} : {paddingLeft: 16},
            endIcon || isLoading ? {paddingRight: 48} : {paddingRight: 16},
          ]}
          placeholderTextColor="#999"
          {...textInputProps}
        />

        {isLoading && (
          <View style={styles.endIconContainer}>
            <ActivityIndicator size="small" color={COLORS.primary} />
          </View>
        )}

        {!isLoading && endIcon && (
          <View style={styles.endIconContainer}>{endIcon}</View>
        )}
      </View>

      {helpText && !error && !successMessage && (
        <Text style={styles.helpText}>{helpText}</Text>
      )}

      {error && <Text style={styles.errorText}>{error}</Text>}

      {successMessage && (
        <Text style={styles.successText}>{successMessage}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  labelContainer: {
    marginBottom: 8,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  required: {
    color: COLORS.error,
  },
  inputContainer: {
    height: 52,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  input: {
    flex: 1,
    height: 52,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1a1a1a',
  },
  startIconContainer: {
    position: 'absolute',
    left: 12,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  endIconContainer: {
    position: 'absolute',
    right: 12,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  inputError: {
    borderColor: COLORS.error,
    backgroundColor: '#fff5f5',
  },
  inputSuccess: {
    borderColor: COLORS.success,
    backgroundColor: '#f5fff5',
  },
  helpText: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  errorText: {
    fontSize: 14,
    color: COLORS.error,
    marginTop: 4,
  },
  successText: {
    fontSize: 14,
    color: COLORS.success,
    marginTop: 4,
  },
});

export default FormInput;
