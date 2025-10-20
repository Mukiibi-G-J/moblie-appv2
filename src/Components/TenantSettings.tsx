import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import {useTenantContext} from '../context/TenantContext';
import {COLORS, FONTS} from '../constants';

export const TenantSettings = () => {
  const {currentTenant, isLoading, error, changeTenant, retryConnection} =
    useTenantContext();
  const [newTenant, setNewTenant] = useState('');

  const handleChangeTenant = async () => {
    if (newTenant && newTenant !== currentTenant) {
      await changeTenant(newTenant);
      setNewTenant('');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tenant Configuration</Text>

      {/* Current Tenant Display */}
      <View style={styles.currentTenantContainer}>
        <Text style={styles.label}>Current Tenant:</Text>
        <Text style={styles.tenantText}>
          {isLoading ? 'Loading...' : currentTenant || 'Not configured'}
        </Text>
      </View>

      {/* Error Display */}
      {error && <Text style={styles.errorText}>{error.message}</Text>}

      {/* New Tenant Input */}
      <View style={styles.inputContainer}>
        <Text style={styles.label}>New Tenant:</Text>
        <TextInput
          style={styles.input}
          value={newTenant}
          onChangeText={setNewTenant}
          placeholder="Enter new tenant name"
          placeholderTextColor={COLORS.gray}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleChangeTenant}
          disabled={isLoading || !newTenant}>
          {isLoading ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.buttonText}>Change Tenant</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.retryButton]}
          onPress={retryConnection}
          disabled={isLoading}>
          <Text style={styles.buttonText}>Retry Connection</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: COLORS.white,
    borderRadius: 8,
    margin: 16,
  },
  title: {
    ...FONTS.h2,
    marginBottom: 16,
    color: COLORS.black,
  },
  currentTenantContainer: {
    marginBottom: 16,
  },
  label: {
    ...FONTS.body4,
    color: COLORS.gray,
    marginBottom: 4,
  },
  tenantText: {
    ...FONTS.h3,
    color: COLORS.primary,
  },
  errorText: {
    ...FONTS.body4,
    color: COLORS.red,
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  input: {
    ...FONTS.body3,
    borderWidth: 1,
    borderColor: COLORS.lightGray1,
    borderRadius: 8,
    padding: 12,
    color: COLORS.black,
  },
  buttonContainer: {
    gap: 12,
  },
  button: {
    backgroundColor: COLORS.primary,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  retryButton: {
    backgroundColor: COLORS.darkgray,
  },
  buttonText: {
    ...FONTS.body3,
    color: COLORS.white,
  },
});
