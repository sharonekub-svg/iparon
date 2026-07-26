import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/src/components/AppText';
import { Chevron } from '@/src/components/Chevron';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { Rule } from '@/src/components/Rule';
import { Screen } from '@/src/components/Screen';
import { ApiError, requestAnalysis } from '@/src/lib/api';
import { formatHebrewDate } from '@/src/lib/format';
import { borderWidth, colors, radius, rowDirection, spacing } from '@/src/theme/tokens';

/**
 * כלל ברזל 3: אין כאן OCR ואין חילוץ טקסט. הקובץ נקרא כמו שהוא, מומר
 * ל-base64 ונשלח ל-Edge Function, שמעבירה אותו למודל ראייה.
 */

type Stage = 'idle' | 'reading' | 'sending';

const stageLabels: Record<Exclude<Stage, 'idle'>, string> = {
  reading: 'קורא את הקובץ…',
  sending: 'שולח לעיבוד…',
};

function titleFromFileName(name: string): string {
  return name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'חומר חדש';
}

export default function UploadScreen() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState<string | null>(null);

  const busy = stage !== 'idle';

  const send = useCallback(
    async (input: { uri: string; title: string; mediaType: string; source: 'pdf' | 'camera' }) => {
      setError(null);
      setStage('reading');

      try {
        const fileBase64 = await new File(input.uri).base64();

        setStage('sending');
        await requestAnalysis({
          title: input.title,
          source: input.source,
          mediaType: input.mediaType,
          fileBase64,
        });

        // חוזרים הביתה. החומר מופיע ברשימה במצב "בעיבוד" ומתעדכן כשהוא מוכן.
        router.back();
      } catch (caught) {
        setStage('idle');
        setError(
          caught instanceof ApiError
            ? caught.message
            : 'קריאת הקובץ נכשלה. נסה קובץ אחר.',
        );
      }
    },
    [router],
  );

  const pickPdf = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (result.canceled || !result.assets?.[0]) {
      return;
    }

    const asset = result.assets[0];
    await send({
      uri: asset.uri,
      title: titleFromFileName(asset.name),
      mediaType: asset.mimeType ?? 'application/pdf',
      source: 'pdf',
    });
  }, [send]);

  const takePhoto = useCallback(async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError('בשביל לצלם דף צריך הרשאה למצלמה. אפשר לאשר בהגדרות.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      // בלי חיתוך: דף שלם עדיף על חצי דף חתוך יפה
      allowsEditing: false,
    });

    if (result.canceled || !result.assets?.[0]) {
      return;
    }

    await send({
      uri: result.assets[0].uri,
      title: `צילום מ־${formatHebrewDate(new Date().toISOString())}`,
      mediaType: result.assets[0].mimeType ?? 'image/jpeg',
      source: 'camera',
    });
  }, [send]);

  return (
    <Screen>
      <View style={styles.bar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="חזרה"
          onPress={() => router.back()}
          disabled={busy}
          hitSlop={spacing.lg}
        >
          <Chevron direction="back" size={11} />
        </Pressable>
        <AppText variant="label">העלאה</AppText>
      </View>

      <Rule />

      <View style={styles.body}>
        <AppText variant="heading">מה נעלה?</AppText>
        <AppText variant="bodySmall" tone="muted" style={styles.lead}>
          צלם דף מהמחברת, או בחר קובץ PDF של סיכום. אפשר גם תמונה שכבר שמורה
          בטלפון. כתב יד עובד — המערכת קוראת את הדף, לא ממירה אותו לטקסט.
        </AppText>

        <View style={styles.actions}>
          <PrimaryButton label="צילום של דף" onPress={takePhoto} disabled={busy} />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="בחירת קובץ"
            onPress={pickPdf}
            disabled={busy}
            style={({ pressed }) => [
              styles.secondary,
              pressed && styles.secondaryPressed,
              busy && styles.disabled,
            ]}
          >
            <AppText variant="bodyStrong" tone="body" style={styles.secondaryLabel}>
              בחירת קובץ מהטלפון
            </AppText>
          </Pressable>
        </View>

        {busy ? (
          <AppText variant="mono" tone="faint" style={styles.status}>
            {stageLabels[stage]}
          </AppText>
        ) : null}

        {error ? (
          <View style={styles.error}>
            <AppText variant="bodySmall" tone="body">
              {error}
            </AppText>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: rowDirection,
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.page,
    paddingVertical: spacing.xl,
  },
  body: {
    padding: spacing.page,
    paddingTop: spacing.xxxl,
  },
  lead: {
    marginTop: spacing.md,
    maxWidth: 420,
  },
  actions: {
    marginTop: spacing.section,
    gap: spacing.md,
  },
  secondary: {
    minHeight: 54,
    borderRadius: radius.sm,
    borderWidth,
    borderColor: colors.lineInput,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryPressed: {
    backgroundColor: colors.surfaceSunk,
  },
  secondaryLabel: {
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.35,
  },
  status: {
    marginTop: spacing.xl,
    textAlign: 'center',
  },
  error: {
    marginTop: spacing.xl,
    borderRadius: radius.sm,
    borderWidth,
    borderColor: colors.lineInput,
    backgroundColor: colors.surfaceSunk,
    padding: spacing.lg,
  },
});
