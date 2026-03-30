# Auth & onboarding audit (task 22)

## Screens and entry

| Route / usage | Component | Notes |
|---------------|-----------|--------|
| `SignIn` stack | `Login.tsx` | Uses `AuthLayout` (layouts) + `FormInput2`; primary CTA uses brand gradient. |
| `SignUp` | `SignUp.tsx` | Uses `AuthLayout` (Screens) + `FormInput`; company validation uses `COLORS.success` / `COLORS.red`. |
| `Otp` | `Otp.tsx` | Uses `AuthLayout` (Screens); email accent `COLORS.primary`. |
| Legacy | `SignIn.tsx` (Screens) | Alternate sign-in; inherits updated `COLORS` + `TextButton`. |
| Onboarding carousel | `OnBoarding/OnBoarding.tsx` | Uses `COLORS` for dots, titles, CTAs; not the splash screen. |

## Gaps addressed (tasks 23–24)

- Global `COLORS` in `src/constants/theme.ts` is driven by `src/design-system/design-system.json` (brand, light scheme, utility).
- `FormInput2` and layouts `AuthLayout` use light scheme borders, radii, and surfaces from the design system.
- `Login` primary button uses `LinearGradient` with `gradientBrand` from `src/design-system/theme.ts`.
- `TextButton` default CTA background uses `COLORS.primary` (brand cyan).
- Splash (`SplashScreen`) unchanged per scope.

## Sign up entry points

- **Login** (`Login.tsx`): footer row “Don’t have an account? **Sign Up**” → `navigation.navigate('SignUp')`.
- **Onboarding slide 1 (hero)**: full-bleed image + gradient; **Create account** uses the same blue gradient as `SplashScreen`; **Sign in** + **Learn more** as before.
- **Onboarding slides 2+**: link **Create an account** below dots → `SignUp`.
- **Sign up** footer: **Sign In** → `navigation.navigate('SignIn')` (reliable from any entry path).

### Hero tuning (if it doesn’t match the reference)

- Use a **darker or busier** `bannerImage` on slide 1 if text feels low-contrast; the overlay is in `OnBoarding.tsx` (`LinearGradient` + `HERO` constants).
- Prefer a **white / light** wordmark on the hero if your logo is dark-on-transparent.
- Shorten **title** / **description** in `constants.ts` so the headline stays above the fold on small phones.

## Follow-up (optional)

- Add Lexend font family to native projects if you want typography.scale parity.
- `FormInput` (v1) used on `SignIn.tsx` / `SignUp` still uses per-screen styles; consider migrating to `FormInput2` later.
