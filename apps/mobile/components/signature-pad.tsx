/**
 * Touch-Signatur-Pad (SVG-Pfade + Capture als PNG-Data-URL via view-shot).
 */

import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  View,
  StyleSheet,
  PanResponder,
  type LayoutChangeEvent,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';

export interface SignaturePadHandle {
  clear: () => void;
  isEmpty: () => boolean;
  /** PNG als Data-URL, oder null wenn leer. */
  toDataURL: () => Promise<string | null>;
}

interface SignaturePadProps {
  height?: number;
}

type Point = { x: number; y: number };

function pointsToPath(points: Point[]): string {
  if (points.length === 0) return '';
  const [first, ...rest] = points;
  let d = `M ${first.x} ${first.y}`;
  for (const p of rest) {
    d += ` L ${p.x} ${p.y}`;
  }
  return d;
}

export const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(
  function SignaturePad({ height = 180 }, ref) {
    const [paths, setPaths] = useState<string[]>([]);
    const current = useRef<Point[]>([]);
    const [livePath, setLivePath] = useState('');
    const captureView = useRef<View>(null);
    const size = useRef({ width: 0, height });

    useImperativeHandle(ref, () => ({
      clear: () => {
        setPaths([]);
        setLivePath('');
        current.current = [];
      },
      isEmpty: () => paths.length === 0 && !livePath,
      toDataURL: async () => {
        if (paths.length === 0 && !livePath) return null;
        if (!captureView.current) return null;
        const uri = await captureRef(captureView, {
          format: 'png',
          quality: 1,
          result: 'base64',
        });
        return `data:image/png;base64,${uri}`;
      },
    }));

    const pan = useRef(
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          const { locationX, locationY } = e.nativeEvent;
          current.current = [{ x: locationX, y: locationY }];
          setLivePath(pointsToPath(current.current));
        },
        onPanResponderMove: (e) => {
          const { locationX, locationY } = e.nativeEvent;
          current.current = [
            ...current.current,
            { x: locationX, y: locationY },
          ];
          setLivePath(pointsToPath(current.current));
        },
        onPanResponderRelease: () => {
          const d = pointsToPath(current.current);
          if (d) {
            setPaths((prev) => [...prev, d]);
          }
          current.current = [];
          setLivePath('');
        },
      }),
    ).current;

    const onLayout = (e: LayoutChangeEvent) => {
      size.current = {
        width: e.nativeEvent.layout.width,
        height: e.nativeEvent.layout.height,
      };
    };

    return (
      <View
        ref={captureView}
        collapsable={false}
        style={[styles.pad, { height }]}
        onLayout={onLayout}
        {...pan.panHandlers}
      >
        <Svg width="100%" height="100%">
          {paths.map((d, i) => (
            <Path
              key={i}
              d={d}
              stroke="#111827"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ))}
          {livePath ? (
            <Path
              d={livePath}
              stroke="#111827"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ) : null}
        </Svg>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  pad: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#374151',
  },
});
