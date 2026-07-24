import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';

interface NfitWidgetProps {
  steps: number;
  goal: number;
}

export function NfitWidget({ steps, goal }: NfitWidgetProps) {
  const progress = Math.min(steps / Math.max(goal, 1), 1);
  
  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 16,
      }}
    >
      <TextWidget
        text="TODAY'S STEPS"
        style={{
          fontSize: 12,
          fontFamily: 'sans-serif-medium',
          color: '#666666',
        }}
      />
      <TextWidget
        text={steps.toString()}
        style={{
          fontSize: 32,
          fontFamily: 'sans-serif-black',
          color: '#000000',
          marginVertical: 8,
        }}
      />
      <FlexWidget
        style={{
          width: 'match_parent',
          height: 8,
          backgroundColor: '#E0E0E0',
          borderRadius: 4,
        }}
      >
        <FlexWidget
          style={{
            width: `${progress * 100}%` as any,
            height: 'match_parent',
            backgroundColor: '#8AB4F8',
            borderRadius: 4,
          }}
        />
      </FlexWidget>
    </FlexWidget>
  );
}
