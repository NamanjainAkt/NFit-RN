import { useEffect, useRef } from 'react';
import { Animated, Dimensions, StyleSheet, View } from 'react-native';

const { width: W, height: H } = Dimensions.get('window');
const COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#F7DC6F', '#BB8FCE', '#E8A0BF'];

interface Particle {
  x: number;
  y: number;
  size: number;
  color: string;
  animY: Animated.Value;
  animOpacity: Animated.Value;
  animRotate: Animated.Value;
}

export default function Confetti() {
  const particles = useRef<Particle[]>([]);

  if (particles.current.length === 0) {
    for (let i = 0; i < 60; i++) {
      particles.current.push({
        x: Math.random() * W,
        y: -30 - Math.random() * 100,
        size: Math.random() * 10 + 4,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        animY: new Animated.Value(0),
        animOpacity: new Animated.Value(1),
        animRotate: new Animated.Value(0),
      });
    }
  }

  useEffect(() => {
    const anims = particles.current.map((p) =>
      Animated.parallel([
        Animated.timing(p.animY, {
          toValue: H + 50,
          duration: 3500 + Math.random() * 2500,
          useNativeDriver: true,
        }),
        Animated.timing(p.animRotate, {
          toValue: Math.random() > 0.5 ? 1 : -1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(2500 + Math.random() * 1500),
          Animated.timing(p.animOpacity, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    Animated.parallel(anims).start();
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.current.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: p.x - p.size / 2,
            top: p.y,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: p.size * 0.3,
            opacity: p.animOpacity,
            transform: [
              { translateY: p.animY },
              {
                rotate: p.animRotate.interpolate({
                  inputRange: [-1, 1],
                  outputRange: ['-180deg', '180deg'],
                }),
              },
            ],
          }}
        />
      ))}
    </View>
  );
}
