/**
 * Typography from the design artifact: IBM Plex Sans for text, IBM Plex Mono for numbers.
 *
 * The fonts are loaded in src/app/_layout.tsx (see FONT_ASSETS). Each weight is its own
 * font family, so styles pick a family instead of setting fontWeight; this renders the
 * real weight on web and Android. If loading fails, the platform default font is used.
 */
import { IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono/500Medium';
import { IBMPlexMono_600SemiBold } from '@expo-google-fonts/ibm-plex-mono/600SemiBold';
import { IBMPlexSans_400Regular } from '@expo-google-fonts/ibm-plex-sans/400Regular';
import { IBMPlexSans_400Regular_Italic } from '@expo-google-fonts/ibm-plex-sans/400Regular_Italic';
import { IBMPlexSans_500Medium } from '@expo-google-fonts/ibm-plex-sans/500Medium';
import { IBMPlexSans_600SemiBold } from '@expo-google-fonts/ibm-plex-sans/600SemiBold';
import { IBMPlexSans_700Bold } from '@expo-google-fonts/ibm-plex-sans/700Bold';
import type { TextStyle } from 'react-native';

export const FONT_ASSETS = {
  IBMPlexSans_400Regular,
  IBMPlexSans_400Regular_Italic,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
  IBMPlexSans_700Bold,
  IBMPlexMono_500Medium,
  IBMPlexMono_600SemiBold,
};

export const fonts = {
  regular: 'IBMPlexSans_400Regular',
  italic: 'IBMPlexSans_400Regular_Italic',
  medium: 'IBMPlexSans_500Medium',
  semibold: 'IBMPlexSans_600SemiBold',
  bold: 'IBMPlexSans_700Bold',
  mono: 'IBMPlexMono_500Medium',
  monoSemibold: 'IBMPlexMono_600SemiBold',
} as const;

/** Kept for Step 0 code: sans = regular text, mono = numbers. */
export const fontFamily = { sans: fonts.regular, mono: fonts.mono } as const;

export const textStyles = {
  pageTitle: { fontSize: 30, lineHeight: 36, fontFamily: fonts.bold },
  lead: { fontSize: 17, lineHeight: 25, fontFamily: fonts.regular },
  sectionTitle: { fontSize: 18, lineHeight: 24, fontFamily: fonts.semibold },
  cardTitle: { fontSize: 17, lineHeight: 23, fontFamily: fonts.semibold },
  body: { fontSize: 15, lineHeight: 22, fontFamily: fonts.regular },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontFamily: fonts.semibold },
  bodySmall: { fontSize: 14, lineHeight: 20, fontFamily: fonts.regular },
  bodySmallStrong: { fontSize: 14, lineHeight: 20, fontFamily: fonts.semibold },
  caption: { fontSize: 13, lineHeight: 18, fontFamily: fonts.regular },
  captionStrong: { fontSize: 13, lineHeight: 18, fontFamily: fonts.semibold },
  label: { fontSize: 12, lineHeight: 16, fontFamily: fonts.semibold, letterSpacing: 0.6, textTransform: 'uppercase' },
  value: { fontSize: 15, lineHeight: 22, fontFamily: fonts.mono },
  valueStrong: { fontSize: 15, lineHeight: 22, fontFamily: fonts.monoSemibold },
} satisfies Record<string, TextStyle>;
