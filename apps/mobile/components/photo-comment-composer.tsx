/**
 * Foto-Vorschau mit Kommentar und optionaler Tipp-Position im Bild.
 * Ohne Position → Server brennt den Text als Banner unten ein.
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  LayoutChangeEvent,
  GestureResponderEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type PhotoCommentPlacement = {
  comment: string;
  xNorm: number | null;
  yNorm: number | null;
};

type Props = {
  uri: string;
  comment: string;
  onCommentChange: (value: string) => void;
  uploading?: boolean;
  onSave: (placement: PhotoCommentPlacement) => void;
  onCancel: () => void;
};

type ImageBox = { width: number; height: number };

/**
 * Relativkoordinaten (0–1) zum sichtbaren Bildinhalt (contain).
 * Tipps außerhalb des Bildes werden ignoriert.
 */
function normFromTouch(
  box: ImageBox,
  natural: ImageBox | null,
  locationX: number,
  locationY: number,
): { x: number; y: number } | null {
  if (box.width <= 0 || box.height <= 0) return null;
  const nw = natural?.width && natural.width > 0 ? natural.width : box.width;
  const nh =
    natural?.height && natural.height > 0 ? natural.height : box.height;
  const scale = Math.min(box.width / nw, box.height / nh);
  const dispW = nw * scale;
  const dispH = nh * scale;
  const offsetX = (box.width - dispW) / 2;
  const offsetY = (box.height - dispH) / 2;
  const x = (locationX - offsetX) / dispW;
  const y = (locationY - offsetY) / dispH;
  if (x < 0 || x > 1 || y < 0 || y > 1) return null;
  return { x, y };
}

export function PhotoCommentComposer({
  uri,
  comment,
  onCommentChange,
  uploading,
  onSave,
  onCancel,
}: Props): React.ReactElement {
  const [placing, setPlacing] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [box, setBox] = useState<ImageBox>({ width: 0, height: 0 });
  const [natural, setNatural] = useState<ImageBox | null>(null);

  const canPlace = comment.trim().length > 0 && !uploading;

  const labelStyle = useMemo(() => {
    if (!pos || box.width <= 0 || box.height <= 0) return null;
    const nw = natural?.width && natural.width > 0 ? natural.width : box.width;
    const nh =
      natural?.height && natural.height > 0 ? natural.height : box.height;
    const scale = Math.min(box.width / nw, box.height / nh);
    const dispW = nw * scale;
    const dispH = nh * scale;
    const offsetX = (box.width - dispW) / 2;
    const offsetY = (box.height - dispH) / 2;
    return {
      left: offsetX + pos.x * dispW,
      top: offsetY + pos.y * dispH,
    };
  }, [pos, box, natural]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBox({ width, height });
  };

  const onImageLoad = (e: {
    nativeEvent: { source: { width: number; height: number } };
  }) => {
    const { width, height } = e.nativeEvent.source;
    if (width > 0 && height > 0) setNatural({ width, height });
  };

  const handlePress = (e: GestureResponderEvent) => {
    if (!placing || !canPlace) return;
    const next = normFromTouch(
      box,
      natural,
      e.nativeEvent.locationX,
      e.nativeEvent.locationY,
    );
    if (!next) return;
    setPos(next);
    setPlacing(false);
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Arbeitsfoto</Text>
      <Text style={styles.hint}>
        Optional Kommentar eingeben. Mit „Text platzieren“ tippst du die
        Position im Bild – sonst erscheint der Text unten als Banner.
      </Text>

      <TouchableOpacity
        activeOpacity={placing ? 0.9 : 1}
        onPress={handlePress}
        disabled={!placing}
        style={styles.imageWrap}
        onLayout={onLayout}
      >
        <Image
          source={{ uri }}
          style={styles.image}
          resizeMode="contain"
          onLoad={onImageLoad}
        />
        {placing && (
          <View style={styles.placeOverlay} pointerEvents="none">
            <Text style={styles.placeOverlayText}>
              Tippe auf die gewünschte Stelle
            </Text>
          </View>
        )}
        {labelStyle && comment.trim() ? (
          <View
            pointerEvents="none"
            style={[
              styles.floatingLabel,
              { left: labelStyle.left, top: labelStyle.top },
            ]}
          >
            <Text style={styles.floatingLabelText} numberOfLines={3}>
              {comment.trim()}
            </Text>
          </View>
        ) : null}
      </TouchableOpacity>

      <TextInput
        style={styles.commentInput}
        value={comment}
        onChangeText={(v) => {
          onCommentChange(v);
          if (!v.trim()) {
            setPos(null);
            setPlacing(false);
          }
        }}
        placeholder="Text / Kommentar (optional)"
        placeholderTextColor="#6b7280"
        multiline
        editable={!uploading}
      />

      <View style={styles.placeRow}>
        <TouchableOpacity
          style={[
            styles.placeButton,
            (!canPlace || placing) && styles.placeButtonDisabled,
          ]}
          disabled={!canPlace || placing}
          onPress={() => setPlacing(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="locate-outline" size={18} color="#f9fafb" />
          <Text style={styles.placeButtonText}>
            {placing ? 'Tippe aufs Bild…' : 'Text platzieren'}
          </Text>
        </TouchableOpacity>
        {pos && (
          <TouchableOpacity
            style={styles.clearPlaceButton}
            onPress={() => {
              setPos(null);
              setPlacing(false);
            }}
            disabled={uploading}
            activeOpacity={0.7}
          >
            <Text style={styles.clearPlaceText}>Position löschen</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={onCancel}
          disabled={uploading}
          activeOpacity={0.7}
        >
          <Text style={styles.cancelText}>Abbrechen</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.saveButton, uploading && styles.saveButtonDisabled]}
          onPress={() =>
            onSave({
              comment: comment.trim(),
              xNorm: pos?.x ?? null,
              yNorm: pos?.y ?? null,
            })
          }
          disabled={uploading}
          activeOpacity={0.7}
        >
          {uploading ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.saveText}>Hochladen</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  title: {
    color: '#f9fafb',
    fontSize: 18,
    fontWeight: '700',
  },
  hint: {
    color: '#9ca3af',
    fontSize: 13,
    lineHeight: 18,
  },
  imageWrap: {
    width: '100%',
    height: 280,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#030712',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  placeOverlayText: {
    color: '#f9fafb',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  floatingLabel: {
    position: 'absolute',
    maxWidth: '70%',
    transform: [{ translateX: -40 }, { translateY: -16 }],
    backgroundColor: 'rgba(0,0,0,0.82)',
    borderColor: '#ffffff',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  floatingLabelText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  commentInput: {
    minHeight: 72,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
    backgroundColor: '#0f172a',
    color: '#f9fafb',
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: 'top',
    fontSize: 15,
  },
  placeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  placeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1d4ed8',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  placeButtonDisabled: {
    opacity: 0.45,
  },
  placeButtonText: {
    color: '#f9fafb',
    fontWeight: '600',
    fontSize: 14,
  },
  clearPlaceButton: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  clearPlaceText: {
    color: '#93c5fd',
    fontSize: 13,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelText: {
    color: '#d1d5db',
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
});
