import { Button } from 'react-native-paper';

import { brand, sage } from '../theme/colors';
import { radius } from '../theme/theme';
import { fontFamily } from '../theme/typography';

// Thin wrapper over Paper's Button that adds the dashboard's "soft" variant —
// a 16%-alpha tint background + dark-toned text (dashboard/src/theme/core/components/button.jsx)
// — explicitly, rather than relying on Paper's mode-to-theme-slot mapping.
export function AppButton({ variant = 'filled', style, labelStyle, ...props }) {
  const variantProps = {
    filled: { mode: 'contained', buttonColor: brand.primary.main, textColor: brand.primary.contrastText },
    soft: { mode: 'contained', buttonColor: sage.tint, textColor: sage.text },
    outlined: { mode: 'outlined', textColor: brand.primary.dark },
    text: { mode: 'text', textColor: brand.primary.dark },
  }[variant];

  return (
    <Button
      {...variantProps}
      style={[{ borderRadius: radius.sm }, style]}
      labelStyle={[{ fontFamily: fontFamily.bold }, labelStyle]}
      {...props}
    />
  );
}
