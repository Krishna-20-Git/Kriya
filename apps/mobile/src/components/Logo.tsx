import { Text, View } from 'react-native';
import { makeStyles } from '../lib/theme-context';

export function Logo() {
  const styles = useStyles();
  return (
    <View style={styles.row} accessible accessibilityLabel="Kriya">
      <View style={styles.mark}>
        {[10, 16, 22].map((width, i) => (
          <View key={width} style={[styles.line, { width, top: 8 + i * 6 }]} />
        ))}
      </View>
      <Text style={styles.word}>Kriya</Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mark: { width: 32, height: 32, borderRadius: 8, backgroundColor: colors.accent },
  line: { position: 'absolute', left: 6, height: 3, borderRadius: 2, backgroundColor: colors.onAccent },
  word: { fontSize: 19, fontWeight: '600', color: colors.ink, letterSpacing: -0.2 },
}));
