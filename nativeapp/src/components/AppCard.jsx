import { StyleSheet, View } from 'react-native';

import { surface } from '../theme/colors';
import { shadow } from '../theme/shadows';
import { radius } from '../theme/theme';

// Ported from dashboard's card recipe (dashboard/src/theme/core/components/card.jsx):
// radius 16, soft diffused shadow — reinterpreted MUJI-style with a hairline
// border doing most of the separation work, shadow kept subtle.
export function AppCard({ style, elevated = false, children, ...props }) {
  return (
    <View style={[styles.card, elevated && shadow.low, style]} {...props}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: surface.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: surface.border,
    padding: 16,
  },
});
