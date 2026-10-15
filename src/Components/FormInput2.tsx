import React, {useState} from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  ViewStyle,
  TextInputProps,
  ActivityIndicator,
} from 'react-native';
import {COLORS} from '../constants';
import {authOnboarding} from '../design-system/authOnboardingTokens';
import {useTheme} from '../context/ThemeContext';

const ao = authOnboarding;
const fieldGap = ao.sectionSpacing.betweenFields;
const bw = ao.borderWidth;

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
  const {colors, isDark} = useTheme();
  const [focused, setFocused] = useState(false);
  const emphasisBorder =
    !error && !successMessage && focused ? bw.sm : bw.hairline;
  const borderColor = error
    ? COLORS.error
    : focused && !error
      ? colors.borderStrong
      : colors.border;

  const errorBg = isDark ? 'rgba(255, 71, 87, 0.12)' : '#fff5f5';
  const successBg = isDark ? 'rgba(0, 184, 148, 0.12)' : '#f5fff5';

  return (
    <View style={[styles.container, containerStyle]}>
      <View style={styles.labelContainer}>
        <Text style={[styles.label, {color: colors.textPrimary}]}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
      </View>

      <View
        style={[
          styles.inputContainer,
          {borderWidth: emphasisBorder, borderColor, backgroundColor: colors.inputBackground},
          error
            ? [styles.inputError, {backgroundColor: errorBg}]
            : successMessage
              ? [styles.inputSuccess, {backgroundColor: successBg}]
              : {},
        ]}>
        {startIcon && (
          <View style={styles.startIconContainer}>{startIcon}</View>
        )}

        <TextInput
          style={[
            styles.input,
            {color: colors.textPrimary},
            startIcon ? {paddingLeft: 48} : {paddingLeft: ao.spacing.md},
            endIcon || isLoading ? {paddingRight: 48} : {paddingRight: ao.spacing.md},
          ]}
          placeholderTextColor={colors.textTertiary}
          onFocus={e => {
            setFocused(true);
            textInputProps.onFocus?.(e);
          }}
          onBlur={e => {
            setFocused(false);
            textInputProps.onBlur?.(e);
          }}
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
        <Text style={[styles.helpText, {color: colors.textSecondary}]}>
          {helpText}
        </Text>
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
    marginBottom: fieldGap,
  },
  labelContainer: {
    marginBottom: ao.spacing.sm,
  },
  label: {
    fontSize: ao.typo.caption,
    fontWeight: '500',
  },
  required: {
    color: COLORS.error,
  },
  inputContainer: {
    minHeight: ao.form.inputMinHeight,
    borderRadius: ao.form.inputRadius,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  input: {
    flex: 1,
    minHeight: ao.form.inputMinHeight,
    paddingHorizontal: ao.spacing.md,
    fontSize: ao.typo.body,
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
    borderWidth: bw.sm,
    borderColor: COLORS.error,
  },
  inputSuccess: {
    borderWidth: bw.hairline,
    borderColor: COLORS.success,
  },
  helpText: {
    fontSize: 14,
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
