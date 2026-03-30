import React from 'react';
import {View, Text, Image, StyleSheet, ViewStyle} from 'react-native';
import {images} from '../../constants';
import {authOnboarding} from '../../design-system/authOnboardingTokens';
import {useTheme} from '../../context/ThemeContext';

const ao = authOnboarding;
const padH = ao.screenPadding.horizontal;
const afterTitle = ao.sectionSpacing.afterTitle;

type Props = {
  title: string;
  subtitle?: React.ReactNode;
  titleContainerStyle?: ViewStyle;
  showLogo?: boolean;
  children: React.ReactNode;
};

/**
 * Form shell for flows wrapped in an outer `ScrollView` (SignUp, legacy SignIn).
 * For standalone screens (Login), use `Components/layouts/AuthLayout`.
 */
const AuthLayout = ({
  title,
  subtitle,
  titleContainerStyle,
  showLogo = false,
  children,
}: Props) => {
  const {colors} = useTheme();
  const hasSubtitle =
    subtitle != null &&
    subtitle !== '' &&
    !(typeof subtitle === 'string' && subtitle.trim() === '');

  return (
    <View style={[styles.root, {backgroundColor: colors.background}]}>
      <View style={styles.inner}>
        {showLogo ? (
          <View style={styles.logoWrap}>
            <Image
              source={images.logo_zentro}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
        ) : null}

        <View style={titleContainerStyle}>
          <Text
            style={[
              styles.title,
              {color: colors.textPrimary},
              hasSubtitle ? styles.titleWithSubtitle : styles.titleOnly,
            ]}>
            {title}
          </Text>
          {hasSubtitle ? (
            typeof subtitle === 'string' ? (
              <Text style={[styles.subtitle, {color: colors.textSecondary}]}>
                {subtitle}
              </Text>
            ) : (
              <View style={styles.subtitleWrap}>{subtitle}</View>
            )
          ) : null}
        </View>

        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  inner: {
    paddingHorizontal: padH,
    paddingTop: ao.screenPadding.vertical,
    paddingBottom: ao.spacing.lg,
  },
  logoWrap: {
    alignItems: 'center',
    marginBottom: ao.spacing.lg,
  },
  logo: {
    width: 160,
    height: 64,
  },
  title: {
    fontSize: ao.typo.title,
    fontWeight: '700',
    textAlign: 'left',
  },
  titleOnly: {
    marginBottom: afterTitle,
  },
  titleWithSubtitle: {
    marginBottom: ao.spacing.sm,
  },
  subtitle: {
    fontSize: ao.typo.body,
    letterSpacing: 0.2,
    marginBottom: afterTitle,
    textAlign: 'left',
  },
  subtitleWrap: {
    marginBottom: afterTitle,
  },
});

export default AuthLayout;
