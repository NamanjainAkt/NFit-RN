import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { NfitWidget } from './NfitWidget';
import { zustandStorage } from '../utils/storage';

export async function widgetTaskHandler({
  widgetAction,
  widgetInfo,
  renderWidget,
}: WidgetTaskHandlerProps) {
  let steps = 0;
  let goal = 10000;

  try {
    const fitnessDataStr = await zustandStorage.getItem('fitness-storage');
    if (fitnessDataStr) {
      const fitnessData = JSON.parse(fitnessDataStr);
      steps = fitnessData.state?.todaySteps || 0;
    }
    
    const userDataStr = await zustandStorage.getItem('user-storage');
    if (userDataStr) {
      const userData = JSON.parse(userDataStr);
      goal = userData.state?.profile?.dailyStepGoal || 10000;
    }
  } catch (error) {
    console.error('Widget error reading storage:', error);
  }

  renderWidget(
    <NfitWidget steps={steps} goal={goal} />
  );
}
