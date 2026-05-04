import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
  ScrollView,
  ViewStyle,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {images, icons} from '../../constants';
import {authOnboarding} from '../../design-system/authOnboardingTokens';
import {useTheme} from '../../context/ThemeContext';
import {QuickIconPressable} from '../QuickIconPressable';

interface AuthLayoutProps {
  /** Main heading (e.g. "Sign in") — flat layout, reference-style */
  title: string;
  /** Optional; string or custom node (e.g. OTP email highlight) */
  subtitle?: React.ReactNode;
  /** Applied to the title + subtitle block */
  titleContainerStyle?: ViewStyle;
  /** Large logo above the card adds noise; default off to match minimal auth references */
  showLogo?: boolean;
  /** 40px circle, light gray — e.g. step 2 or when stack can go back */
  showBackButton?: boolean;
  onBackPress?: () => void;
  /** Top-right slot (e.g. “Sign in” pill on sign-up) */
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}

const padH = authOnboarding.screenPadding.horizontal;
const afterTitle = authOnboarding.sectionSpacing.afterTitle;

const AuthLayout = ({
  title,
  subtitle,
  titleContainerStyle,
  showLogo = false,
  showBackButton = false,
  onBackPress,
  headerRight,
  children,
}: AuthLayoutProps) => {
  const {colors} = useTheme();
  const hasSubtitle =
    subtitle != null &&
    subtitle !== '' &&
    !(typeof subtitle === 'string' && subtitle.trim() === '');
  return (
    <SafeAreaView
      style={[styles.container, {backgroundColor: colors.background}]}
      edges={['top', 'left', 'right']}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}>
          <View style={styles.body}>
            {(showBackButton && onBackPress) || headerRight != null ? (
              <View style={styles.topBar}>
                <View style={styles.topBarLeft}>
                  {showBackButton && onBackPress ? (
                    <QuickIconPressable
                      onPress={onBackPress}
                      style={[
                        styles.backCircle,
                        {backgroundColor: colors.backButtonBg},
                      ]}
                      accessibilityLabel="Go back"
                      hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
                      <Image
                        source={icons.back}
                        style={[styles.backIcon, {tintColor: colors.textPrimary}]}
                        resizeMode="contain"
                      />
                    </QuickIconPressable>
                  ) : (
                    <View style={styles.backPlaceholder} />
                  )}
                </View>
                <View style={styles.topBarFlex} />
                {headerRight != null ? (
                  <View style={styles.headerRightWrap}>{headerRight}</View>
                ) : null}
              </View>
            ) : null}

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
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: authOnboarding.spacing.xl + authOnboarding.spacing.sm,
    paddingBottom: authOnboarding.screenPadding.vertical,
  },
  body: {
    paddingHorizontal: padH,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: authOnboarding.spacing.sm,
  },
  topBarLeft: {
    minWidth: 40,
  },
  topBarFlex: {
    flex: 1,
  },
  headerRightWrap: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  backPlaceholder: {
    width: 40,
    height: 40,
  },
  backCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    width: 20,
    height: 20,
  },
  logoWrap: {
    alignItems: 'center',
    marginBottom: authOnboarding.spacing.lg,
  },
  logo: {
    width: 160,
    height: 64,
  },
  title: {
    fontSize: authOnboarding.typo.title,
    fontWeight: '700',
    textAlign: 'left',
  },
  titleOnly: {
    marginBottom: afterTitle,
  },
  titleWithSubtitle: {
    marginBottom: authOnboarding.spacing.sm,
  },
  subtitle: {
    fontSize: authOnboarding.typo.body,
    letterSpacing: 0.2,
    marginBottom: afterTitle,
    textAlign: 'left',
  },
  subtitleWrap: {
    marginBottom: afterTitle,
  },
});

export default AuthLayout;
