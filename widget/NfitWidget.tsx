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
      clickAction="OPEN_APP"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#1E1E1E',
        borderRadius: 16,
        padding: 16,
      }}
    >
      <TextWidget
        text="TODAY'S STEPS"
        style={{
          fontSize: 12,
          fontFamily: 'sans-serif-medium',
          color: '#AAAAAA',
        }}
      />
      <TextWidget
        text={steps.toLocaleString()}
        style={{
          fontSize: 32,
          fontFamily: 'sans-serif-black',
          color: '#FFFFFF',
          marginVertical: 8,
        }}
      />
      <FlexWidget
        style={{
          width: 'match_parent',
          height: 8,
          backgroundColor: '#333333',
          borderRadius: 4,
        }}
      >
        <FlexWidget
          style={{
            width: `${Math.max(progress * 100, 2)}%` as any,
            height: 'match_parent',
            backgroundColor: '#4CAF50',
            borderRadius: 4,
          }}
        />
      </FlexWidget>
    </FlexWidget>
  );
}
