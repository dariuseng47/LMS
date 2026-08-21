// Font scale ported from dashboard/src/theme/core/typography.js (Public Sans body,
// Barlow headings). React Native has no CSS variable-font weights, so each weight
// is loaded as a discrete font family via @expo-google-fonts/*.

import {
  PublicSans_400Regular,
  PublicSans_500Medium,
  PublicSans_600SemiBold,
  PublicSans_700Bold,
} from '@expo-google-fonts/public-sans';
import { Barlow_700Bold, Barlow_800ExtraBold } from '@expo-google-fonts/barlow';

export const fontFamily = {
  regular: 'PublicSans_400Regular',
  medium: 'PublicSans_500Medium',
  semiBold: 'PublicSans_600SemiBold',
  bold: 'PublicSans_700Bold',
  headingBold: 'Barlow_700Bold',
  headingExtraBold: 'Barlow_800ExtraBold',
};

export const googleFontsToLoad = {
  PublicSans_400Regular,
  PublicSans_500Medium,
  PublicSans_600SemiBold,
  PublicSans_700Bold,
  Barlow_700Bold,
  Barlow_800ExtraBold,
};

export const type = {
  h1: { fontFamily: fontFamily.headingExtraBold, fontSize: 32, lineHeight: 40 },
  h2: { fontFamily: fontFamily.headingBold, fontSize: 26, lineHeight: 34 },
  h3: { fontFamily: fontFamily.headingBold, fontSize: 21, lineHeight: 28 },
  subtitle1: { fontFamily: fontFamily.semiBold, fontSize: 16, lineHeight: 24 },
  subtitle2: { fontFamily: fontFamily.semiBold, fontSize: 14, lineHeight: 20 },
  body1: { fontFamily: fontFamily.regular, fontSize: 16, lineHeight: 24 },
  body2: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 18 },
  overline: {
    fontFamily: fontFamily.bold,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  button: { fontFamily: fontFamily.bold, fontSize: 14, lineHeight: 20 },
};
