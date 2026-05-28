// components/auth/AuthInput.tsx
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { authColors, authRadius, authSpace, authType, authHitSlop } from '../../utils/authTheme';

type AuthInputType = 'email' | 'password' | 'text';

interface AuthInputProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  type?: AuthInputType;
  placeholder?: string;
  autoFocus?: boolean;
  returnKeyType?: TextInputProps['returnKeyType'];
  onSubmitEditing?: TextInputProps['onSubmitEditing'];
  error?: string;
  hint?: string;
  editable?: boolean;
}

export default function AuthInput({
  label,
  value,
  onChangeText,
  type = 'text',
  placeholder,
  autoFocus,
  returnKeyType,
  onSubmitEditing,
  error,
  hint,
  editable = true,
}: AuthInputProps) {
  const [secureVisible, setSecureVisible] = useState(false);
  const isPassword = type === 'password';
  const isEmail = type === 'email';
  const hasError = !!error;

  const toggleSecure = () => setSecureVisible((prev) => !prev);

  return (
    <View style={styles.wrapper}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <View style={[styles.field, hasError && styles.fieldError]}>
        <TextInput
          style={[styles.input, isPassword && styles.inputWithRightSlot]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={authColors.placeholder}
          autoFocus={autoFocus}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          editable={editable}
          secureTextEntry={isPassword && !secureVisible}
          autoCapitalize={isEmail || isPassword ? 'none' : undefined}
          autoCorrect={!isEmail && !isPassword}
          keyboardType={isEmail ? 'email-address' : 'default'}
          textContentType={
            isEmail ? 'emailAddress' : isPassword ? 'password' : undefined
          }
          accessibilityLabel={label}
        />
        {isPassword ? (
          <Pressable
            onPress={toggleSecure}
            hitSlop={authHitSlop}
            style={styles.eyeButton}
            accessibilityRole="button"
            accessibilityLabel={secureVisible ? 'Hide password' : 'Show password'}
          >
            <Ionicons
              name={secureVisible ? 'eye-off-outline' : 'eye-outline'}
              size={22}
              color={authColors.textTertiary}
            />
          </Pressable>
        ) : null}
      </View>
      {hasError ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  label: {
    fontSize: authType.label.fontSize,
    fontWeight: authType.label.fontWeight,
    color: authColors.textPrimary,
  },
  hint: {
    fontSize: 13,
    fontWeight: '400',
    color: authColors.textTertiary,
    marginLeft: authSpace.sm,
  },
  field: {
    width: '100%',
    backgroundColor: authColors.inputBg,
    borderWidth: 1.5,
    borderColor: authColors.inputBorder,
    borderRadius: authRadius.input,
    flexDirection: 'row',
    alignItems: 'center',
  },
  fieldError: {
    borderColor: authColors.inputBorderError,
  },
  input: {
    flex: 1,
    paddingHorizontal: authSpace.lg,
    paddingVertical: authSpace.lg,
    fontSize: 16,
    color: authColors.textPrimary,
  },
  inputWithRightSlot: {
    paddingRight: 48,
  },
  eyeButton: {
    position: 'absolute',
    right: authSpace.md,
    top: 0,
    bottom: 0,
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    marginTop: 6,
    fontSize: 13,
    color: authColors.error,
  },
});
